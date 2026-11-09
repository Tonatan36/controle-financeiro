const { createClient } = require('@libsql/client');
const { timingSafeEqual } = require('node:crypto');

let client;

function respostaErro(res, status, erro) {
    return res.status(status).json({ erro });
}

function autenticado(req) {
    const senha = process.env.SYNC_PASSWORD;
    const autorizacao = req.headers.authorization || '';
    const fornecida = autorizacao.startsWith('Bearer ') ? autorizacao.slice(7) : '';
    if (!senha || !fornecida) return false;
    const esperado = Buffer.from(senha);
    const recebida = Buffer.from(fornecida);
    return esperado.length === recebida.length && timingSafeEqual(esperado, recebida);
}

function obterCliente() {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;
    if (!url || !token) throw new Error('Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN.');
    if (!client) client = createClient({ url, authToken: token });
    return client;
}

function validarEstado(estado) {
    if (!estado || typeof estado !== 'object'
        || !Array.isArray(estado.lancamentos)
        || !estado.categorias || typeof estado.categorias !== 'object' || Array.isArray(estado.categorias)
        || !Array.isArray(estado.metasFinanceiras)) return false;

    const categoriasValidas = Object.entries(estado.categorias).every(([nome, valor]) =>
        nome.trim().length > 0
        && !['__proto__', 'prototype', 'constructor'].includes(nome)
        && Number.isSafeInteger(valor) && valor >= 0
    );
    const lancamentosValidos = estado.lancamentos.every(item =>
        item && typeof item.id === 'string' && item.id.length > 0
        && typeof item.descricao === 'string' && item.descricao.trim().length > 0
        && ['Receita', 'Despesa'].includes(item.tipo)
        && typeof item.categoria === 'string'
        && typeof item.quem === 'string'
        && Number.isSafeInteger(item.valorCentavos) && item.valorCentavos > 0
        && (item.formaPagamento === undefined || item.formaPagamento === '' || ['avista', 'parcelada'].includes(item.formaPagamento))
        && (item.origemPagamento === undefined || typeof item.origemPagamento === 'string' && item.origemPagamento.length <= 60)
        && (item.parcelas === undefined || Number.isSafeInteger(item.parcelas) && item.parcelas >= 1 && item.parcelas <= 120)
        && (item.parcelaAtual === undefined || Number.isSafeInteger(item.parcelaAtual) && item.parcelaAtual >= 1)
        && (item.parcelas === undefined || item.parcelaAtual === undefined || item.parcelaAtual <= item.parcelas)
        && (item.tipo !== 'Despesa' || !['avista', 'parcelada'].includes(item.formaPagamento)
            || typeof item.origemPagamento === 'string' && item.origemPagamento.trim().length > 0)
        && validarData(item.data)
    );
    const metasValidas = estado.metasFinanceiras.every(meta =>
        meta && typeof meta.id === 'string' && meta.id.length > 0
        && typeof meta.nome === 'string' && meta.nome.trim().length > 0
        && Number.isSafeInteger(meta.alvo) && meta.alvo >= 0
        && typeof meta.prazo === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(meta.prazo)
    );

    return categoriasValidas && lancamentosValidos && metasValidas
        && Buffer.byteLength(JSON.stringify(estado), 'utf8') <= 2 * 1024 * 1024;
}

function validarData(data) {
    if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
    const [ano, mes, dia] = data.split('-').map(Number);
    const dataVerificada = new Date(Date.UTC(ano, mes - 1, dia));
    return dataVerificada.getUTCFullYear() === ano
        && dataVerificada.getUTCMonth() === mes - 1
        && dataVerificada.getUTCDate() === dia;
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'PUT') {
        res.setHeader('Allow', 'GET, PUT');
        return respostaErro(res, 405, 'Método não permitido.');
    }
    if (!autenticado(req)) return respostaErro(res, 401, 'Senha de sincronização inválida.');

    try {
        const db = obterCliente();
        await db.execute(`
            CREATE TABLE IF NOT EXISTS app_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                state TEXT NOT NULL,
                revision INTEGER NOT NULL
            )
        `);

        if (req.method === 'GET') {
            const resultado = await db.execute('SELECT state, revision FROM app_state WHERE id = 1');
            if (!resultado.rows.length) return res.status(200).json({ state: null, revision: 0 });
            return res.status(200).json({
                state: JSON.parse(resultado.rows[0].state),
                revision: Number(resultado.rows[0].revision)
            });
        }

        const { state, expectedRevision } = req.body || {};
        if (!validarEstado(state) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
            return respostaErro(res, 400, 'Estado ou revisão inválidos.');
        }

        const transacao = await db.transaction('write');
        try {
            const resultado = await transacao.execute('SELECT revision FROM app_state WHERE id = 1');
            const revisaoAtual = resultado.rows.length ? Number(resultado.rows[0].revision) : 0;
            if (revisaoAtual !== expectedRevision) {
                await transacao.rollback();
                return res.status(409).json({ erro: 'Os dados mudaram em outro dispositivo. Sincronize novamente.', revision: revisaoAtual });
            }

            const novaRevisao = revisaoAtual + 1;
            await transacao.execute({
                sql: `INSERT INTO app_state (id, state, revision) VALUES (1, ?, ?)
                      ON CONFLICT(id) DO UPDATE SET state = excluded.state, revision = excluded.revision`,
                args: [JSON.stringify(state), novaRevisao]
            });
            await transacao.commit();
            return res.status(200).json({ revision: novaRevisao });
        } catch (erro) {
            await transacao.rollback();
            throw erro;
        }
    } catch (erro) {
        console.error('Erro na sincronização com Turso:', erro);
        return respostaErro(res, 500, 'Não foi possível acessar o banco de sincronização.');
    }
};

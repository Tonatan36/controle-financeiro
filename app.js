const STORAGE = 'controleFinanceiroCasal-v2';
const categoriasPadrao = {
    Mercado: 90000,
    Moradia: 150000,
    Transporte: 50000,
    Lazer: 30000,
    Salário: 0
};

let banco = carregar();
let lancamentos = banco.lancamentos;
let categorias = banco.categorias;
let metasFinanceiras = banco.metasFinanceiras || [];
let historico = [];
let ordenacao = { campo: 'data', direcao: -1 };

const el = {
    mes: $('mesAnalise'), tabela: $('tabelaLancamentos'), saldo: $('kpiSaldo'), receitas: $('kpiReceitas'),
    despesas: $('kpiDespesas'), orcamento: $('kpiOrcamento'), metas: $('listaMetas'), resumo: $('resumoCategorias'),
    formulario: $('formLancamento'), mensagem: $('mensagem'), quantidade: $('quantidadeLancamentos'),
    categoria: $('lancCategoria'), filtroCategoria: $('filtroCategoria')
};
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

inicializar();

function $(id) { return document.getElementById(id); }

function novoId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function carregar() {
    try {
        const salvo = JSON.parse(localStorage.getItem(STORAGE));
        if (salvo && validarBackup(salvo, false)) {
            salvo.lancamentos.forEach(item => {
                if (item.quem === 'Pessoa 1') item.quem = 'Blenda';
                if (item.quem === 'Pessoa 2') item.quem = 'Ewerton';
            });
            return salvo;
        }
    } catch (erro) {
        console.error('Não foi possível ler os dados locais.', erro);
    }
    return { lancamentos: [], categorias: categoriasPadrao, metasFinanceiras: [] };
}

function salvar() {
    try {
        const conteudo = JSON.stringify({ lancamentos, categorias, metasFinanceiras });
        localStorage.setItem(STORAGE, conteudo);
        if (localStorage.getItem(STORAGE) !== conteudo) throw new Error('O navegador não confirmou o armazenamento.');
        return true;
    } catch (erro) {
        console.error('Não foi possível salvar os dados locais.', erro);
        mensagem('Não foi possível salvar os dados. Verifique o armazenamento do navegador.', true);
        return false;
    }
}

function inicializar() {
    popularMeses();
    popularCategorias();
    $('lancData').value = hoje();
    if (localStorage.getItem('tema') === 'dark') document.body.classList.add('dark');
    el.mes.addEventListener('change', atualizar);
    el.formulario.addEventListener('submit', salvarLancamento);
    ['filtroBusca', 'filtroTipo', 'filtroCategoria', 'filtroQuem'].forEach(id => $(id).addEventListener('input', atualizar));
    document.querySelectorAll('.sort').forEach(botao => botao.addEventListener('click', () => ordenar(botao.dataset.sort)));
    $('tabelaLancamentos').addEventListener('click', acaoTabela);
    $('limparLancamentos').addEventListener('click', limparTudo);
    $('limparMes').addEventListener('click', limparMes);
    $('exportarJson').addEventListener('click', exportarJson);
    $('exportarCsv').addEventListener('click', exportarCsv);
    $('importarJson').addEventListener('change', importarJson);
    $('tema').addEventListener('click', alternarTema);
    $('cancelarEdicao').addEventListener('click', cancelarEdicao);
    $('gerenciarCategorias').addEventListener('click', abrirCategorias);
    $('formCategorias').addEventListener('submit', salvarCategorias);
    $('importarCsv').addEventListener('change', importarExtrato);
    $('relatorio').addEventListener('click', mostrarRelatorioAnual);
    $('imprimir').addEventListener('click', () => window.print());
    $('desfazer').addEventListener('click', desfazer);
    $('adicionarMeta').addEventListener('click', () => $('dialogMeta').showModal());
    $('formMeta').addEventListener('submit', salvarMeta);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);
    atualizar();
}

function popularMeses() {
    const meses = [...new Set([...lancamentos.map(item => item.data.slice(0, 7)), hoje().slice(0, 7)])].sort();
    el.mes.replaceChildren();
    meses.forEach(mes => el.mes.add(new Option(nomeMes(mes), mes)));
    el.mes.value = hoje().slice(0, 7);
}

function popularCategorias() {
    const nomes = Object.keys(categorias).sort();
    el.categoria.replaceChildren(...nomes.map(nome => new Option(nome, nome)));
    el.filtroCategoria.replaceChildren(new Option('Todas as categorias', ''), ...nomes.map(nome => new Option(nome, nome)));
    $('categoriasTexto').value = nomes.map(nome => `${nome};${(categorias[nome] / 100).toFixed(2)}`).join('\n');
}

function atualizar() {
    let filtrados = lancamentos.filter(item => item.data.startsWith(el.mes.value));
    const busca = $('filtroBusca').value.trim().toLowerCase();
    const tipo = $('filtroTipo').value;
    const categoria = el.filtroCategoria.value;
    const quem = $('filtroQuem').value;
    if (busca) filtrados = filtrados.filter(item => item.descricao.toLowerCase().includes(busca));
    if (tipo) filtrados = filtrados.filter(item => item.tipo === tipo);
    if (categoria) filtrados = filtrados.filter(item => item.categoria === categoria);
    if (quem) filtrados = filtrados.filter(item => item.quem === quem);

    const receitas = total(filtrados, 'Receita');
    const despesas = total(filtrados, 'Despesa');
    const metas = Object.values(categorias).reduce((soma, valor) => soma + valor, 0);
    el.receitas.textContent = formatar(receitas);
    el.despesas.textContent = formatar(despesas);
    el.saldo.textContent = formatar(receitas - despesas);
    el.saldo.classList.toggle('negativo', receitas - despesas < 0);
    el.orcamento.textContent = `${metas ? Math.round(despesas / metas * 100) : 0}%`;
    el.quantidade.textContent = `${filtrados.length} lançamento${filtrados.length === 1 ? '' : 's'}`;
    renderizarTabela(filtrados);
    renderizarMetas(lancamentosDoMes());
    renderizarGraficos(lancamentosDoMes());
    renderizarCalendario();
    renderizarResumoAnual();
    renderizarMetasFinanceiras();
}

function lancamentosDoMes() {
    return lancamentos.filter(item => item.data.startsWith(el.mes.value));
}

function total(itens, tipo) {
    return itens.filter(item => item.tipo === tipo).reduce((soma, item) => soma + item.valorCentavos, 0);
}

function renderizarTabela(itens) {
    itens = [...itens].sort((a, b) => {
        const va = ordenacao.campo === 'data' ? a.data : a.valorCentavos;
        const vb = ordenacao.campo === 'data' ? b.data : b.valorCentavos;
        return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * ordenacao.direcao;
    });
    el.tabela.replaceChildren();
    if (!itens.length) {
        el.tabela.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum lançamento encontrado.</td></tr>';
        return;
    }
    itens.forEach(item => {
        const linha = document.createElement('tr');
        const dados = [formatarData(item.data), item.descricao, item.tipo, item.categoria, item.quem];
        dados.forEach((valor, indice) => {
            const td = document.createElement('td');
            if (indice === 2) {
                const badge = document.createElement('span');
                badge.className = `badge ${item.tipo.toLowerCase()}`;
                badge.textContent = valor;
                td.append(badge);
            } else td.textContent = valor;
            linha.append(td);
        });
        const valor = document.createElement('td');
        valor.textContent = `${item.tipo === 'Receita' ? '+' : '-'} ${formatar(item.valorCentavos)}`;
        valor.className = item.tipo === 'Receita' ? 'positivo' : 'negativo';
        linha.append(valor);
        const acoes = document.createElement('td');
        const editar = document.createElement('button');
        editar.type = 'button';
        editar.className = 'btn-edit';
        editar.dataset.acao = 'editar';
        editar.dataset.id = item.id;
        editar.textContent = 'Editar';
        const apagar = document.createElement('button');
        apagar.type = 'button';
        apagar.className = 'btn-delete';
        apagar.dataset.acao = 'excluir';
        apagar.dataset.id = item.id;
        apagar.textContent = 'Apagar';
        acoes.append(editar, apagar);
        linha.append(acoes);
        el.tabela.append(linha);
    });
}

function acaoTabela(evento) {
    const botao = evento.target.closest('[data-acao]');
    if (!botao) return;
    if (botao.dataset.acao === 'editar') editarLancamento(botao.dataset.id);
    else excluirLancamento(botao.dataset.id);
}

function salvarLancamento(evento) {
    evento.preventDefault();
    const descricao = $('lancDesc').value.trim();
    const valor = Number($('lancValor').value);
    const data = $('lancData').value;
    if (descricao.length < 3) return mensagem('Informe uma descrição com pelo menos 3 caracteres.', true);
    if (!data || !Number.isFinite(valor) || valor <= 0) return mensagem('Informe uma data e um valor válidos.', true);
    const dataNormalizada = normalizarData(data);
    if (!dataNormalizada) return mensagem('Informe uma data válida.', true);
    const parcelas = Math.max(1, Number($('lancParcelas').value) || 1);
    const recorrencia = $('lancRecorrencia').value;
    if (parcelas > 1 && recorrencia) return mensagem('Parcelamento e recorrência não podem ser usados juntos.', true);
    const id = $('lancId').value;
    const dados = {
        id: id || novoId(),
        data: dataNormalizada, descricao, tipo: $('lancTipo').value, categoria: el.categoria.value,
        quem: $('lancQuem').value, valorCentavos: Math.round(valor * 100),
        situacao: $('lancSituacao').value, natureza: $('lancNatureza').value,
        parcelas, recorrencia, observacao: $('lancObservacao').value.trim(),
        parcelaAtual: 1
    };
    const estadoAnterior = capturarEstado();
    if (id) lancamentos[lancamentos.findIndex(item => item.id === id)] = dados;
    else {
        lancamentos.push(dados);
        criarParcelas(dados);
        criarRecorrencia(dados);
    }
    if (!salvar()) {
        restaurarEstado(estadoAnterior);
        return;
    }
    registrarMudanca(estadoAnterior);
    cancelarEdicao();
    popularMeses();
    el.mes.value = dataNormalizada.slice(0, 7);
    atualizar();
    mensagem(id ? 'Lançamento atualizado.' : 'Lançamento adicionado.');
}

function editarLancamento(id) {
    const item = lancamentos.find(lancamento => lancamento.id === id);
    if (!item) return;
    $('lancId').value = item.id;
    $('lancData').value = item.data;
    $('lancDesc').value = item.descricao;
    $('lancTipo').value = item.tipo;
    el.categoria.value = item.categoria;
    $('lancQuem').value = item.quem;
    $('lancValor').value = (item.valorCentavos / 100).toFixed(2);
    $('lancSituacao').value = item.situacao || 'Concluído';
    $('lancNatureza').value = item.natureza || 'Variável';
    $('lancParcelas').value = item.parcelas || 1;
    $('lancRecorrencia').value = item.recorrencia || '';
    $('lancObservacao').value = item.observacao || '';
    $('tituloFormulario').textContent = 'Editar Lançamento';
    $('botaoSalvar').textContent = 'Salvar alterações';
    $('cancelarEdicao').classList.remove('hidden');
    $('lancDesc').focus();
}

function cancelarEdicao() {
    el.formulario.reset();
    $('lancId').value = '';
    $('lancData').value = hoje();
    $('tituloFormulario').textContent = 'Novo Lançamento';
    $('botaoSalvar').textContent = 'Adicionar Lançamento';
    $('cancelarEdicao').classList.add('hidden');
}

function excluirLancamento(id) {
    const item = lancamentos.find(lancamento => lancamento.id === id);
    if (item && confirm(`Apagar "${item.descricao}"?`)) {
        const estadoAnterior = capturarEstado();
        lancamentos = lancamentos.filter(lancamento => lancamento.id !== id);
        if (!salvar()) {
            restaurarEstado(estadoAnterior);
            return;
        }
        registrarMudanca(estadoAnterior);
        atualizar(); mensagem('Lançamento apagado.');
    }
}

function limparTudo() {
    if (lancamentos.length && confirm('Apagar todos os lançamentos registrados?')) {
        const estadoAnterior = capturarEstado();
        lancamentos = [];
        if (!salvar()) {
            restaurarEstado(estadoAnterior);
            return;
        }
        registrarMudanca(estadoAnterior);
        popularMeses(); atualizar(); mensagem('Todos os lançamentos foram apagados.');
    }
}

function limparMes() {
    const itens = lancamentosDoMes();
    if (itens.length && confirm(`Apagar todos os lançamentos de ${nomeMes(el.mes.value)}?`)) {
        const estadoAnterior = capturarEstado();
        lancamentos = lancamentos.filter(item => !item.data.startsWith(el.mes.value));
        if (!salvar()) {
            restaurarEstado(estadoAnterior);
            return;
        }
        registrarMudanca(estadoAnterior);
        atualizar(); mensagem('Lançamentos do mês apagados.');
    }
}

function renderizarMetas(itens) {
    el.metas.replaceChildren();
    el.resumo.replaceChildren();
    Object.entries(categorias).forEach(([categoria, meta]) => {
        const gasto = total(itens.filter(item => item.tipo === 'Despesa' && item.categoria === categoria), 'Despesa');
        const percentual = meta ? Math.round(gasto / meta * 100) : 0;
        const item = document.createElement('div');
        item.className = 'category-progress';
        const informacoes = document.createElement('div');
        informacoes.className = 'category-info';
        const rotuloCategoria = document.createElement('span');
        rotuloCategoria.textContent = `${categoria} (Meta: ${formatar(meta)})`;
        const rotuloGasto = document.createElement('span');
        rotuloGasto.textContent = `Gasto: ${formatar(gasto)} (${percentual}%)`;
        informacoes.append(rotuloCategoria, rotuloGasto);
        item.append(informacoes);
        const barra = document.createElement('div');
        barra.className = 'progress-bar';
        barra.setAttribute('role', 'progressbar');
        barra.setAttribute('aria-valuemin', '0');
        barra.setAttribute('aria-valuemax', '100');
        barra.setAttribute('aria-valuenow', String(Math.min(percentual, 100)));
        const preenchimento = document.createElement('div');
        preenchimento.className = `progress-fill${percentual >= 100 ? ' danger' : percentual >= 80 ? ' warning' : ''}`;
        preenchimento.style.width = `${Math.min(percentual, 100)}%`;
        barra.append(preenchimento);
        item.append(barra);
        el.metas.append(item);

        const resumo = document.createElement('div');
        resumo.className = 'summary-item';
        const titulo = document.createElement('strong');
        titulo.textContent = categoria;
        resumo.append(titulo, document.createTextNode(`${formatar(gasto)} de ${formatar(meta)}`));
        el.resumo.append(resumo);
    });
}

function ordenar(campo) {
    ordenacao.direcao = ordenacao.campo === campo ? ordenacao.direcao * -1 : -1;
    ordenacao.campo = campo;
    atualizar();
}

function renderizarGraficos(itens) {
    desenharGraficoCategorias(itens);
    desenharEvolucao();
}

function desenharGraficoCategorias(itens) {
    const canvas = $('graficoCategorias');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = 220 * window.devicePixelRatio;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dados = Object.keys(categorias).map(nome => ({
        nome,
        valor: total(itens.filter(item => item.tipo === 'Despesa' && item.categoria === nome), 'Despesa')
    })).filter(item => item.valor > 0);
    $('descricaoGraficoCategorias').textContent = dados.length
        ? dados.map(item => `${item.nome}: ${formatar(item.valor)}`).join('; ')
        : 'Sem despesas neste mês.';
    if (!dados.length) return ctx.fillText('Sem despesas neste mês', 20, 40);
    const maximo = Math.max(...dados.map(item => item.valor));
    dados.forEach((item, indice) => {
        const y = 35 + indice * 34;
        ctx.fillStyle = '#6b7280';
        ctx.font = `${12 * window.devicePixelRatio}px sans-serif`;
        ctx.fillText(item.nome, 10, y);
        ctx.fillStyle = '#818cf8';
        ctx.fillRect(110, y - 12, (canvas.width - 130) * item.valor / maximo, 18);
        ctx.fillStyle = '#1f2937';
        ctx.fillText(formatar(item.valor), 115, y + 2);
    });
}

function desenharEvolucao() {
    const canvas = $('graficoEvolucao');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = 220 * window.devicePixelRatio;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const meses = [...new Set(lancamentos.map(item => item.data.slice(0, 7)))].sort().slice(-6);
    if (!meses.length) return;
    let acumulado = 0;
    const valores = meses.map(mes => {
        const itens = lancamentos.filter(item => item.data.startsWith(mes));
        acumulado += total(itens, 'Receita') - total(itens, 'Despesa');
        return acumulado;
    });
    const maximo = Math.max(...valores.map(Math.abs), 1);
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 3 * window.devicePixelRatio;
    ctx.beginPath();
    valores.forEach((valor, indice) => {
        const x = 30 + indice * (canvas.width - 60) / Math.max(valores.length - 1, 1);
        const y = canvas.height / 2 - (valor / maximo) * (canvas.height / 2 - 30);
        indice ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        ctx.fillStyle = '#4f46e5';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
    });
    ctx.stroke();
    $('descricaoGraficoEvolucao').textContent = meses.map((mes, indice) =>
        `${nomeMes(mes)}: ${formatar(valores[indice])}`
    ).join('; ');
}

function abrirCategorias() {
    popularCategorias();
    $('dialogCategorias').showModal();
}

function salvarCategorias(evento) {
    evento.preventDefault();
    const novas = {};
    for (const linha of $('categoriasTexto').value.split('\n')) {
        const [nome, valor] = linha.split(';').map(parte => parte.trim());
        if (!nome) continue;
        if (['__proto__', 'prototype', 'constructor'].includes(nome)) {
            return mensagem('Nome de categoria reservado não permitido.', true);
        }
        const meta = Number(String(valor || 0).replace(',', '.'));
        if (!Number.isFinite(meta) || meta < 0) return mensagem('Meta inválida. Use números iguais ou maiores que zero.', true);
        novas[nome] = Math.round(meta * 100);
    }
    if (!Object.keys(novas).length) return mensagem('Informe pelo menos uma categoria.', true);
    const estadoAnterior = capturarEstado();
    categorias = novas;
    if (!salvar()) {
        restaurarEstado(estadoAnterior);
        return;
    }
    registrarMudanca(estadoAnterior);
    popularCategorias();
    $('dialogCategorias').close();
    atualizar();
    mensagem('Categorias e metas atualizadas.');
}

function exportarJson() {
    baixar(JSON.stringify({ lancamentos, categorias, metasFinanceiras }, null, 2), 'controle-financeiro.json', 'application/json');
}

function importarJson(evento) {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
        try {
            const dados = JSON.parse(leitor.result);
            if (!validarBackup(dados)) throw new Error();
            if (!confirm('Restaurar este backup substituirá todos os dados atuais. Deseja continuar?')) return;
            const estadoAnterior = capturarEstado();
            lancamentos = dados.lancamentos;
            categorias = dados.categorias;
            metasFinanceiras = dados.metasFinanceiras || [];
            if (!salvar()) {
                restaurarEstado(estadoAnterior);
                return;
            }
            registrarMudanca(estadoAnterior);
            popularMeses(); popularCategorias(); atualizar(); mensagem('Backup restaurado.');
        } catch {
            mensagem('Arquivo de backup inválido.', true);
        }
    };
    leitor.readAsText(arquivo);
    evento.target.value = '';
}

function exportarCsv() {
    const linhas = [['Data', 'Descrição', 'Tipo', 'Categoria', 'Quem', 'Valor'], ...lancamentosDoMes().map(item =>
        [item.data, item.descricao, item.tipo, item.categoria, item.quem, (item.valorCentavos / 100).toFixed(2)]
    )];
    baixar(linhas.map(linha => linha.map(csv).join(',')).join('\n'), 'lancamentos.csv', 'text/csv;charset=utf-8');
}

function csv(valor) { return `"${String(valor).replaceAll('"', '""')}"`; }

function baixar(conteudo, nome, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const link = document.createElement('a');
    link.href = url; link.download = nome; link.click();
    URL.revokeObjectURL(url);
}

function alternarTema() {
    document.body.classList.toggle('dark');
    localStorage.setItem('tema', document.body.classList.contains('dark') ? 'dark' : 'light');
    atualizar();
}

function hoje() {
    const data = new Date();
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function normalizarData(valor) {
    if (typeof valor !== 'string') return '';
    const texto = valor.trim();
    let partes;
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) partes = texto.split('-').map(Number);
    else if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
        const [dia, mes, ano] = texto.split('/').map(Number);
        partes = [ano, mes, dia];
    } else return '';
    const [ano, mes, dia] = partes;
    const data = new Date(ano, mes - 1, dia);
    if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return '';
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function validarLancamento(item) {
    return item && typeof item === 'object'
        && typeof item.id === 'string'
        && typeof item.descricao === 'string' && item.descricao.trim().length > 0
        && ['Receita', 'Despesa'].includes(item.tipo)
        && typeof item.categoria === 'string'
        && typeof item.quem === 'string'
        && Number.isInteger(item.valorCentavos) && item.valorCentavos > 0
        && Boolean(normalizarData(item.data));
}

function validarBackup(dados, exigirMetas = true) {
    if (!dados || typeof dados !== 'object' || !Array.isArray(dados.lancamentos)
        || !dados.categorias || Array.isArray(dados.categorias) || typeof dados.categorias !== 'object') return false;
    if (Object.keys(dados.categorias).some(nome => ['__proto__', 'prototype', 'constructor'].includes(nome))) return false;
    if (!Object.values(dados.categorias).every(valor => Number.isInteger(valor) && valor >= 0)) return false;
    if (!dados.lancamentos.every(validarLancamento)) return false;
    if (exigirMetas && dados.metasFinanceiras !== undefined && !Array.isArray(dados.metasFinanceiras)) return false;
    return !exigirMetas || dados.metasFinanceiras === undefined || dados.metasFinanceiras.every(meta =>
        meta && typeof meta.id === 'string' && typeof meta.nome === 'string'
        && Number.isInteger(meta.alvo) && meta.alvo >= 0 && typeof meta.prazo === 'string'
        && meta.nome.trim().length > 0 && /^\d{4}-\d{2}$/.test(meta.prazo)
    );
}

function formatar(centavos) { return moeda.format(centavos / 100); }
function formatarData(data) { const [ano, mes, dia] = data.split('-'); return `${dia}/${mes}/${ano}`; }
function nomeMes(mes) { const [ano, numero] = mes.split('-').map(Number); return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(ano, numero - 1, 1)); }
function mensagem(texto, erro = false) {
    el.mensagem.textContent = texto;
    el.mensagem.classList.toggle('erro', erro);
    clearTimeout(mensagem.timer);
    mensagem.timer = setTimeout(() => el.mensagem.textContent = '', 5000);
}

function criarParcelas(original) {
    const totalParcelas = original.parcelas || 1;
    if (totalParcelas <= 1) return;
    const valorOriginal = original.valorCentavos;
    lancamentos.pop();
    lancamentos.push({ ...original, descricao: `${original.descricao} (1/${totalParcelas})`, parcelaAtual: 1 });
    for (let parcela = 2; parcela <= totalParcelas; parcela++) {
        const data = somarMeses(original.data, parcela - 1);
        lancamentos.push({
            ...original, id: novoId(), data, descricao: `${original.descricao} (${parcela}/${totalParcelas})`,
            parcelaAtual: parcela, valorCentavos: valorOriginal
        });
    }
}

function criarRecorrencia(original) {
    if (!original.recorrencia) return;
    const originalId = original.id;
    for (let mes = 1; mes <= 12; mes++) {
        lancamentos.push({
            ...original, id: `${originalId}-${mes}`, data: somarMeses(original.data, mes),
            descricao: `${original.descricao} (${mes + 1}ª ocorrência)`
        });
    }
}

function somarMeses(dataIso, meses) {
    const [ano, mes, dia] = dataIso.split('-').map(Number);
    const indiceMes = ano * 12 + mes - 1 + meses;
    const anoDestino = Math.floor(indiceMes / 12);
    const mesDestino = indiceMes % 12 + 1;
    const ultimoDia = new Date(anoDestino, mesDestino, 0).getDate();
    return `${anoDestino}-${String(mesDestino).padStart(2, '0')}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`;
}

function capturarEstado() {
    return JSON.parse(JSON.stringify({ lancamentos, categorias, metasFinanceiras }));
}

function restaurarEstado(estado) {
    lancamentos = estado.lancamentos;
    categorias = estado.categorias;
    metasFinanceiras = estado.metasFinanceiras;
}

function registrarMudanca(estadoAnterior) {
    historico.push(JSON.stringify(estadoAnterior || capturarEstado()));
    if (historico.length > 20) historico.shift();
}

function desfazer() {
    if (!historico.length) return mensagem('Não há alterações para desfazer.', true);
    const estadoDesfeito = historico.pop();
    const estadoAtual = capturarEstado();
    const estado = JSON.parse(estadoDesfeito);
    lancamentos = estado.lancamentos;
    categorias = estado.categorias;
    metasFinanceiras = estado.metasFinanceiras;
    if (!salvar()) {
        restaurarEstado(estadoAtual);
        historico.push(estadoDesfeito);
        return;
    }
    popularMeses();
    popularCategorias();
    atualizar();
    mensagem('Última alteração desfeita.');
}

function renderizarCalendario() {
    const calendario = $('calendario');
    calendario.replaceChildren();
    const [ano, mes] = el.mes.value.split('-').map(Number);
    const primeiroDia = new Date(ano, mes - 1, 1).getDay();
    const diasNoMes = new Date(ano, mes, 0).getDate();
    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(nome => {
        const rotulo = document.createElement('strong');
        rotulo.textContent = nome;
        calendario.append(rotulo);
    });
    for (let indice = 0; indice < primeiroDia; indice++) {
        const vazio = document.createElement('div');
        vazio.className = 'calendar-empty';
        calendario.append(vazio);
    }
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const data = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const gastos = lancamentosDoMes().filter(item => item.data === data && item.tipo === 'Despesa')
            .reduce((soma, item) => soma + item.valorCentavos, 0);
        const celula = document.createElement('div');
        celula.className = 'calendar-day';
        const numeroDia = document.createElement('strong');
        numeroDia.textContent = dia;
        celula.append(numeroDia);
        if (gastos) {
            const valorGasto = document.createElement('span');
            valorGasto.className = 'calendar-value';
            valorGasto.textContent = formatar(gastos);
            celula.append(valorGasto);
        }
        calendario.append(celula);
    }
}

function renderizarResumoAnual() {
    const ano = el.mes.value.slice(0, 4);
    const resumo = $('resumoAnual');
    resumo.replaceChildren();
    for (let mes = 1; mes <= 12; mes++) {
        const prefixo = `${ano}-${String(mes).padStart(2, '0')}`;
        const itens = lancamentos.filter(item => item.data.startsWith(prefixo));
        const receitas = total(itens, 'Receita');
        const despesas = total(itens, 'Despesa');
        const bloco = document.createElement('div');
        bloco.className = 'summary-item';
        const titulo = document.createElement('strong');
        titulo.textContent = nomeMes(prefixo).split(' ')[0];
        const saldo = document.createElement('div');
        saldo.textContent = `Saldo: ${formatar(receitas - despesas)}`;
        const economia = document.createElement('div');
        economia.textContent = `Economia: ${receitas ? Math.round((receitas - despesas) / receitas * 100) : 0}%`;
        bloco.append(titulo, saldo, economia);
        resumo.append(bloco);
    }
}

function salvarMeta(evento) {
    evento.preventDefault();
    const nome = $('metaNome').value.trim();
    const valor = Number($('metaValor').value);
    if (!nome || !Number.isFinite(valor) || valor <= 0) return mensagem('Informe um nome e um valor alvo válidos.', true);
    const estadoAnterior = capturarEstado();
    metasFinanceiras.push({
        id: novoId(), nome,
        alvo: Math.round(valor * 100), prazo: $('metaPrazo').value
    });
    if (!salvar()) {
        restaurarEstado(estadoAnterior);
        return;
    }
    registrarMudanca(estadoAnterior);
    $('dialogMeta').close();
    $('formMeta').reset();
    renderizarMetasFinanceiras();
    mensagem('Meta financeira adicionada.');
}

function renderizarMetasFinanceiras() {
    const container = $('listaMetasFinanceiras');
    container.replaceChildren();
    if (!metasFinanceiras.length) {
        container.innerHTML = '<div class="muted">Nenhuma meta financeira cadastrada.</div>';
        return;
    }
    metasFinanceiras.forEach(meta => {
        const acumulado = lancamentos.filter(item => item.tipo === 'Receita').reduce((soma, item) => soma + item.valorCentavos, 0)
            - lancamentos.filter(item => item.tipo === 'Despesa').reduce((soma, item) => soma + item.valorCentavos, 0);
        const percentual = meta.alvo ? Math.min(100, Math.round(acumulado / meta.alvo * 100)) : 0;
        const item = document.createElement('div');
        item.className = 'summary-item';
        const titulo = document.createElement('strong');
        titulo.textContent = meta.nome;
        const detalhes = document.createElement('div');
        detalhes.textContent = `${formatar(Math.max(acumulado, 0))} de ${formatar(meta.alvo)} (${percentual}%)`;
        const prazo = document.createElement('div');
        prazo.textContent = `Prazo: ${meta.prazo}`;
        item.append(titulo, detalhes, prazo);
        container.append(item);
    });
}

function mostrarRelatorioAnual() {
    renderizarResumoAnual();
    $('resumoAnual').scrollIntoView({ behavior: 'smooth' });
    mensagem('Relatório anual atualizado.');
}

function importarExtrato(evento) {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
        const texto = leitor.result;
        const novos = arquivo.name.toLowerCase().endsWith('.ofx')
            ? importarOfx(texto)
            : importarCsvTexto(texto);
        if (!novos.length) return mensagem('Nenhuma transação reconhecida no arquivo.', true);
        const estadoAnterior = capturarEstado();
        novos.forEach(item => {
            if (!Object.prototype.hasOwnProperty.call(categorias, item.categoria)
                && !['__proto__', 'prototype', 'constructor'].includes(item.categoria)) {
                categorias[item.categoria] = 0;
            }
        });
        lancamentos.push(...novos);
        if (!salvar()) {
            restaurarEstado(estadoAnterior);
            return;
        }
        registrarMudanca(estadoAnterior);
        popularMeses();
        atualizar();
        mensagem(`${novos.length} transações importadas.`);
    };
    leitor.readAsText(arquivo);
    evento.target.value = '';
}

function importarCsvTexto(texto) {
    const linhas = texto.trim().split(/\r?\n/).filter(Boolean);
    const [cabecalho, ...dados] = linhas.map(linha => parseCsv(linha));
    const indice = nome => cabecalho.findIndex(valor => valor.toLowerCase() === nome.toLowerCase());
    const campos = {
        data: indice('Data'), descricao: indice('Descrição'), tipo: indice('Tipo'),
        categoria: indice('Categoria'), quem: indice('Quem'), valor: indice('Valor')
    };
    if (campos.data < 0 || campos.descricao < 0 || campos.valor < 0) {
        campos.data = 0; campos.descricao = 1; campos.tipo = 2;
        campos.categoria = 3; campos.quem = 4; campos.valor = 5;
    }
    return dados.map(partes => {
        const data = normalizarData(partes[campos.data]);
        const descricao = partes[campos.descricao]?.trim();
        const valor = partes[campos.valor]?.trim();
        if (!data || !descricao || !valor) return null;
        const valorNumerico = Number(valor.includes(',')
            ? valor.replace(/\./g, '').replace(',', '.')
            : valor.replace(',', '.'));
        const valorCentavos = Math.round(valorNumerico * 100);
        if (!Number.isFinite(valorNumerico) || valorCentavos <= 0) return null;
        return {
            id: novoId(), data, descricao,
            tipo: ['Receita', 'Despesa'].includes(partes[campos.tipo]?.trim()) ? partes[campos.tipo].trim() : 'Despesa',
            categoria: partes[campos.categoria]?.trim() || 'Outros',
            quem: partes[campos.quem]?.trim() || 'Juntos',
            valorCentavos: Math.abs(valorCentavos), situacao: 'Concluído', natureza: 'Variável'
        };
    }).filter(Boolean);
}

function parseCsv(linha) {
    const partes = [];
    let atual = '';
    let aspas = false;
    for (let indice = 0; indice < linha.length; indice++) {
        const caractere = linha[indice];
        if (caractere === '"') {
            if (aspas && linha[indice + 1] === '"') {
                atual += '"';
                indice++;
            } else aspas = !aspas;
        } else if (caractere === ',' && !aspas) {
            partes.push(atual.trim());
            atual = '';
        } else atual += caractere;
    }
    partes.push(atual.trim());
    return partes;
}

function importarOfx(texto) {
    const transacoes = [];
    const blocos = texto.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>|$)/gi)
        || texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi)
        || [];
    for (const bloco of blocos) {
        const valorTexto = bloco.match(/<TRNAMT>([-\d.,]+)/i)?.[1].replace(',', '.');
        const nome = bloco.match(/<MEMO>([^<]+)/i)?.[1].trim();
        const dataTexto = bloco.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/i);
        if (!valorTexto || !dataTexto) continue;
        const valorCentavos = Math.round(Math.abs(Number(valorTexto)) * 100);
        transacoes.push({
            id: novoId(), data: `${dataTexto[1]}-${dataTexto[2]}-${dataTexto[3]}`,
            descricao: nome || 'Importação bancária', tipo: Number(valorTexto) >= 0 ? 'Receita' : 'Despesa',
            categoria: Number(valorTexto) >= 0 ? 'Outros' : 'Mercado', quem: 'Juntos',
            valorCentavos, situacao: 'Concluído', natureza: 'Variável'
        });
    }
    return transacoes;
}

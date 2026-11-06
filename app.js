const STORAGE = 'controleFinanceiroCasal-v2';
const dadosPadrao = [
    { id: 'exemplo-1', data: '2026-11-05', descricao: 'Exemplo – Salário', tipo: 'Receita', categoria: 'Salário', quem: 'Pessoa 1', valorCentavos: 400000 },
    { id: 'exemplo-2', data: '2026-11-06', descricao: 'Exemplo – Compras do mês', tipo: 'Despesa', categoria: 'Mercado', quem: 'Pessoa 2', valorCentavos: 45000 }
];
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

function carregar() {
    try {
        const salvo = JSON.parse(localStorage.getItem(STORAGE));
        if (salvo && Array.isArray(salvo.lancamentos) && salvo.categorias) return salvo;
    } catch (erro) {
        console.error('Não foi possível ler os dados locais.', erro);
    }
    return { lancamentos: dadosPadrao, categorias: categoriasPadrao, metasFinanceiras: [] };
}

function salvar() {
    localStorage.setItem(STORAGE, JSON.stringify({ lancamentos, categorias, metasFinanceiras }));
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
    const id = $('lancId').value;
    const dados = {
        id: id || crypto.randomUUID(),
        data, descricao, tipo: $('lancTipo').value, categoria: el.categoria.value,
        quem: $('lancQuem').value, valorCentavos: Math.round(valor * 100),
        situacao: $('lancSituacao').value, natureza: $('lancNatureza').value,
        parcelas: Math.max(1, Number($('lancParcelas').value) || 1),
        recorrencia: $('lancRecorrencia').value, observacao: $('lancObservacao').value.trim(),
        parcelaAtual: 1
    };
    registrarMudanca();
    if (id) lancamentos[lancamentos.findIndex(item => item.id === id)] = dados;
    else {
        lancamentos.push(dados);
        criarParcelas(dados);
        criarRecorrencia(dados);
    }
    salvar();
    cancelarEdicao();
    popularMeses();
    el.mes.value = data.slice(0, 7);
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
        registrarMudanca();
        lancamentos = lancamentos.filter(lancamento => lancamento.id !== id);
        salvar(); atualizar(); mensagem('Lançamento apagado.');
    }
}

function limparTudo() {
    if (lancamentos.length && confirm('Apagar todos os lançamentos registrados?')) {
        registrarMudanca();
        lancamentos = []; salvar(); popularMeses(); atualizar(); mensagem('Todos os lançamentos foram apagados.');
    }
}

function limparMes() {
    const itens = lancamentosDoMes();
    if (itens.length && confirm(`Apagar todos os lançamentos de ${nomeMes(el.mes.value)}?`)) {
        registrarMudanca();
        lancamentos = lancamentos.filter(item => !item.data.startsWith(el.mes.value));
        salvar(); atualizar(); mensagem('Lançamentos do mês apagados.');
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
        item.innerHTML = `<div class="category-info"><span>${categoria} (Meta: ${formatar(meta)})</span><span>Gasto: ${formatar(gasto)} (${percentual}%)</span></div>`;
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
        resumo.innerHTML = `<strong>${categoria}</strong>${formatar(gasto)} de ${formatar(meta)}`;
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
        const meta = Number(String(valor || 0).replace(',', '.'));
        if (!Number.isFinite(meta) || meta < 0) return mensagem('Meta inválida. Use números iguais ou maiores que zero.', true);
        novas[nome] = Math.round(meta * 100);
    }
    if (!Object.keys(novas).length) return mensagem('Informe pelo menos uma categoria.', true);
    categorias = novas;
    salvar();
    popularCategorias();
    $('dialogCategorias').close();
    atualizar();
    mensagem('Categorias e metas atualizadas.');
}

function exportarJson() {
    baixar(JSON.stringify({ lancamentos, categorias }, null, 2), 'controle-financeiro.json', 'application/json');
}

function importarJson(evento) {
    const arquivo = evento.target.files[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => {
        try {
            const dados = JSON.parse(leitor.result);
            if (!Array.isArray(dados.lancamentos) || !dados.categorias) throw new Error();
            if (!dados.lancamentos.every(item => Number.isInteger(item.valorCentavos) && item.data && item.descricao)) throw new Error();
            lancamentos = dados.lancamentos;
            categorias = dados.categorias;
            salvar(); popularMeses(); popularCategorias(); atualizar(); mensagem('Backup restaurado.');
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
            ...original, id: crypto.randomUUID(), data, descricao: `${original.descricao} (${parcela}/${totalParcelas})`,
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
    const data = new Date(ano, mes - 1 + meses, dia);
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(Math.min(dia, new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate())).padStart(2, '0')}`;
}

function registrarMudanca() {
    historico.push(JSON.stringify({ lancamentos, categorias, metasFinanceiras }));
    if (historico.length > 20) historico.shift();
}

function desfazer() {
    if (!historico.length) return mensagem('Não há alterações para desfazer.', true);
    const estado = JSON.parse(historico.pop());
    lancamentos = estado.lancamentos;
    categorias = estado.categorias;
    metasFinanceiras = estado.metasFinanceiras;
    salvar();
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
        celula.innerHTML = `<strong>${dia}</strong>`;
        if (gastos) celula.insertAdjacentHTML('beforeend', `<span class="calendar-value">${formatar(gastos)}</span>`);
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
        bloco.innerHTML = `<strong>${nomeMes(prefixo).split(' ')[0]}</strong>Saldo: ${formatar(receitas - despesas)}<br>Economia: ${receitas ? Math.round((receitas - despesas) / receitas * 100) : 0}%`;
        resumo.append(bloco);
    }
}

function salvarMeta(evento) {
    evento.preventDefault();
    registrarMudanca();
    metasFinanceiras.push({
        id: crypto.randomUUID(), nome: $('metaNome').value.trim(),
        alvo: Math.round(Number($('metaValor').value) * 100), prazo: $('metaPrazo').value
    });
    salvar();
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
        item.innerHTML = `<strong>${meta.nome}</strong>${formatar(Math.max(acumulado, 0))} de ${formatar(meta.alvo)} (${percentual}%)<br>Prazo: ${meta.prazo}`;
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
        registrarMudanca();
        lancamentos.push(...novos);
        salvar();
        popularMeses();
        atualizar();
        mensagem(`${novos.length} transações importadas.`);
    };
    leitor.readAsText(arquivo);
    evento.target.value = '';
}

function importarCsvTexto(texto) {
    const linhas = texto.trim().split(/\r?\n/).slice(1);
    return linhas.map(linha => {
        const partes = linha.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const [data, descricao, tipo, categoria, quem, valor] = partes.map(valor => valor.replace(/^"|"$/g, '').replace(/""/g, '"'));
        if (!data || !descricao || !valor) return null;
        const valorCentavos = Math.round(Number(valor.replace(',', '.')) * 100);
        return {
            id: crypto.randomUUID(), data, descricao, tipo: tipo || 'Despesa',
            categoria: categoria || 'Outros', quem: quem || 'Pessoa 1',
            valorCentavos: Math.abs(valorCentavos), situacao: 'Concluído', natureza: 'Variável'
        };
    }).filter(Boolean);
}

function importarOfx(texto) {
    const transacoes = [];
    for (const bloco of texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || []) {
        const valorTexto = bloco.match(/<TRNAMT>([-\d.,]+)/i)?.[1].replace(',', '.');
        const nome = bloco.match(/<MEMO>([^<]+)/i)?.[1].trim();
        const dataTexto = bloco.match(/<DTPOSTED>(\d{4})(\d{2})(\d{2})/i);
        if (!valorTexto || !dataTexto) continue;
        const valorCentavos = Math.round(Math.abs(Number(valorTexto)) * 100);
        transacoes.push({
            id: crypto.randomUUID(), data: `${dataTexto[1]}-${dataTexto[2]}-${dataTexto[3]}`,
            descricao: nome || 'Importação bancária', tipo: Number(valorTexto) >= 0 ? 'Receita' : 'Despesa',
            categoria: Number(valorTexto) >= 0 ? 'Outros' : 'Mercado', quem: 'Pessoa 1',
            valorCentavos, situacao: 'Concluído', natureza: 'Variável'
        });
    }
    return transacoes;
}

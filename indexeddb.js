(function () {
    const NOME_BANCO = 'controle-financeiro';
    const VERSAO_BANCO = 1;
    const NOME_ARMAZENAMENTO = 'dados';
    const CHAVE_DADOS = 'principal';
    let conexao;

    function abrirBanco() {
        if (!('indexedDB' in window)) {
            return Promise.reject(new Error('Este navegador não oferece suporte ao IndexedDB.'));
        }
        if (conexao) return conexao;

        conexao = new Promise((resolve, reject) => {
            const requisicao = indexedDB.open(NOME_BANCO, VERSAO_BANCO);
            requisicao.onupgradeneeded = () => {
                if (!requisicao.result.objectStoreNames.contains(NOME_ARMAZENAMENTO)) {
                    requisicao.result.createObjectStore(NOME_ARMAZENAMENTO, { keyPath: 'id' });
                }
            };
            requisicao.onsuccess = () => {
                const banco = requisicao.result;
                banco.onversionchange = () => {
                    banco.close();
                    conexao = null;
                };
                resolve(banco);
            };
            requisicao.onerror = () => reject(requisicao.error || new Error('Não foi possível abrir o IndexedDB.'));
            requisicao.onblocked = () => reject(new Error('A abertura do IndexedDB está bloqueada por outra aba.'));
        });

        return conexao;
    }

    function aguardarTransacao(transacao) {
        return new Promise((resolve, reject) => {
            transacao.oncomplete = () => resolve();
            transacao.onerror = () => reject(transacao.error || new Error('A transação do IndexedDB falhou.'));
            transacao.onabort = () => reject(transacao.error || new Error('A transação do IndexedDB foi cancelada.'));
        });
    }

    async function carregar() {
        const banco = await abrirBanco();
        const transacao = banco.transaction(NOME_ARMAZENAMENTO, 'readonly');
        const concluida = aguardarTransacao(transacao);
        const requisicao = transacao.objectStore(NOME_ARMAZENAMENTO).get(CHAVE_DADOS);
        const requisicaoConcluida = new Promise((resolve, reject) => {
            requisicao.onsuccess = () => resolve(requisicao.result);
            requisicao.onerror = () => reject(requisicao.error || new Error('Não foi possível ler os dados do IndexedDB.'));
        });
        const [registro] = await Promise.all([requisicaoConcluida, concluida]);
        return registro ? registro.dados : null;
    }

    async function salvar(dados) {
        const banco = await abrirBanco();
        const transacao = banco.transaction(NOME_ARMAZENAMENTO, 'readwrite');
        const concluida = aguardarTransacao(transacao);
        transacao.objectStore(NOME_ARMAZENAMENTO).put({ id: CHAVE_DADOS, dados });
        await concluida;
    }

    window.financeiroDB = { carregar, salvar };
})();

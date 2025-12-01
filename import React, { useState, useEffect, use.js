import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, addDoc, query, serverTimestamp, deleteDoc } from 'firebase/firestore';

// Variáveis globais fornecidas pelo ambiente para Firebase
const appId = typeof __app_id !== 'undefined' ? __app_id : 'psico-crm-default-app';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- DADOS E Mapeamento de CNPJ e CREDENCIAIS DE ACESSO (SIMULAÇÃO) ---
const COMPANY_MAPPING = [
    { cnpj: '00.111.222/0001-33', name: 'Clínica Mente Sã', city: 'São Paulo', login: 'sp.admin', senha: '123' },
    { cnpj: '44.555.666/0001-77', name: 'Espaço Equilíbrio', city: 'Rio de Janeiro', login: 'rj.admin', senha: '123' },
    { cnpj: '77.888.999/0001-11', name: 'Apoio Psicológico BH', city: 'Belo Horizonte', login: 'bh.admin', senha: '123' },
    
    // Usuário de Teste com acesso a todas
    { cnpj: '00.111.222/0001-33', name: 'Clínica Mente Sã (TESTE)', city: 'São Paulo', login: 'teste.acesso', senha: '456' },
    { cnpj: '44.555.666/0001-77', name: 'Espaço Equilíbrio (TESTE)', city: 'Rio de Janeiro', login: 'teste.acesso', senha: '456' },
    { cnpj: '77.888.999/0001-11', name: 'Apoio Psicológico BH (TESTE)', city: 'Belo Horizonte', login: 'teste.acesso', senha: '456' },
];

// --- Configuração das Cores e Estilos ---
const primaryColor = 'bg-indigo-600 hover:bg-indigo-700';
const primaryTextColor = 'text-indigo-600';
const secondaryColor = 'bg-teal-500 hover:bg-teal-600';
const focusRing = 'focus:ring-indigo-500';

// --- Utilitários de Data e Formatação ---
const toDate = (timestamp) => timestamp?.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date());
const formatDate = (timestamp) => toDate(timestamp).toLocaleDateString('pt-BR');
const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- NOVO: Função de Formatação Robusta de CNPJ ---
const formatCNPJ = (value) => {
    // 1. Remove tudo que não for dígito
    let cleanValue = value.replace(/\D/g, ''); 
    // 2. Limita a 14 dígitos (máximo de um CNPJ)
    cleanValue = cleanValue.substring(0, 14);

    // 3. Aplica a máscara progressivamente
    if (cleanValue.length > 12) {
        // 00.000.000/0000-00 (14 dígitos)
        return cleanValue.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    } else if (cleanValue.length > 8) {
        // 00.000.000/0000 (9 a 12 dígitos)
        return cleanValue.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})$/, '$1.$2.$3/$4');
    } else if (cleanValue.length > 5) {
        // 00.000.000 (6 a 8 dígitos)
        return cleanValue.replace(/^(\d{2})(\d{3})(\d{1,3})$/, '$1.$2.$3');
    } else if (cleanValue.length > 2) {
        // 00.000 (3 a 5 dígitos)
        return cleanValue.replace(/^(\d{2})(\d{1,3})$/, '$1.$2');
    }
    
    // Retorna o valor limpo se tiver 1 ou 2 dígitos
    return cleanValue;
};


// --- Componentes de Ícones (Inalterados) ---
const UserIcon = (props) => (<svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const BackIcon = (props) => (<svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>);
const PlusIcon = (props) => (<svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const CalendarIcon = (props) => (<svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>);
const ChartIcon = (props) => (<svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l-3 3m0 0l-3-3m3 3v13h18V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>);
const MenuIcon = (props) => (<svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const XIcon = (props) => (<svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const MailIcon = (props) => (<svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>);
const LockClosedIcon = (props) => (<svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 11V7a2 2 0 014 0v4" /></svg>);


// --- Tela de Login ---
const LoginScreen = ({ onLoginSuccess }) => {
    const [cnpj, setCnpj] = useState('');
    const [login, setLogin] = useState('');
    const [senha, setSenha] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');

        const validUser = COMPANY_MAPPING.find(user => 
            // A comparação é feita com o valor *formatado* que está no state (e na lista de mapeamento)
            user.cnpj === cnpj && 
            user.login === login && 
            user.senha === senha
        );

        if (validUser) {
            onLoginSuccess(validUser.cnpj, validUser.name);
        } else {
            setError('Credenciais inválidas. Verifique o CNPJ, Login e Senha.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-2xl">
                <h1 className="text-3xl font-extrabold text-center mb-6">
                    Acesso <span className={primaryTextColor}>Psico</span>CRM
                </h1>
                <p className="text-center text-gray-600 mb-8">
                    Informe suas credenciais para acessar a gestão da sua clínica.
                </p>

                <form onSubmit={handleLogin} className="space-y-6">
                    
                    <div>
                        <label htmlFor="cnpj-input" className="block text-sm font-medium text-gray-700 mb-2">
                            CNPJ da Clínica
                        </label>
                        <input
                            id="cnpj-input"
                            type="text"
                            value={cnpj}
                            onChange={(e) => setCnpj(formatCNPJ(e.target.value))} // Usa a função de formatação CNPJ
                            placeholder="00.000.000/0000-00"
                            required
                            className={`w-full p-3 border border-gray-300 rounded-xl ${focusRing} focus:ring-2 focus:border-transparent transition`}
                            maxLength={18} // Limita o tamanho do campo formatado
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="login-input" className="block text-sm font-medium text-gray-700 mb-2">
                            Login (E-mail ou Usuário)
                        </label>
                        <input
                            id="login-input"
                            type="text"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            placeholder="seu.login@clinicax.com"
                            required
                            className={`w-full p-3 border border-gray-300 rounded-xl ${focusRing} focus:ring-2 focus:border-transparent transition`}
                        />
                    </div>

                    <div>
                        <label htmlFor="senha-input" className="block text-sm font-medium text-gray-700 mb-2">
                            Senha
                        </label>
                        <input
                            id="senha-input"
                            type="password"
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            placeholder="********"
                            required
                            className={`w-full p-3 border border-gray-300 rounded-xl ${focusRing} focus:ring-2 focus:border-transparent transition`}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className={`w-full text-white ${primaryColor} font-bold py-3 rounded-xl shadow-lg transition duration-150 flex items-center justify-center space-x-2`}
                    >
                        <LockClosedIcon className="w-5 h-5" />
                        <span>Entrar no CRM</span>
                    </button>
                    
                    <div className="text-center text-xs text-gray-500 pt-4 border-t border-dashed">
                        <p className="font-semibold mb-1">Credenciais de Teste (Simulação):</p>
                        <p>Acesso Geral: Login: **teste.acesso** | Senha: **456**</p>
                        <p className="mt-1">Use um dos três CNPJs abaixo com o login/senha geral para testar o acesso a cada clínica:</p>
                        <p className="mt-1 font-mono text-[10px] space-x-2 flex justify-center flex-wrap">
                            <span className="bg-gray-200 px-1 py-0.5 rounded">00.111.222/0001-33</span>
                            <span className="bg-gray-200 px-1 py-0.5 rounded">44.555.666/0001-77</span>
                            <span className="bg-gray-200 px-1 py-0.5 rounded">77.888.999/0001-11</span>
                        </p>
                    </div>

                </form>
            </div>
        </div>
    );
};


// --- Componente Principal da Aplicação ---
const App = () => {
    // 1. Estados de Autenticação e Firebase
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [initializationError, setInitializationError] = useState(null);
    
    // 2. Estado de Multi-Empresa
    const [activeCNPJ, setActiveCNPJ] = useState(null);
    const [companyName, setCompanyName] = useState(null);
    
    // 3. Estados da Aplicação
    const [activeTab, setActiveTab] = useState('Leads');
    const [clients, setClients] = useState([]);
    const [consultations, setConsultations] = useState([]);
    const [leads, setLeads] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [activeClient, setActiveClient] = useState(null); 
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768); 
    const [isConsultationModalOpen, setIsConsultationModalOpen] = useState(false);
    const [clientForConsultation, setClientForConsultation] = useState(null);

    // --- 1. Inicialização do Firebase e Autenticação ---
    useEffect(() => {
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
            const errorMsg = "Erro Crítico: A configuração do Firebase (__firebase_config) está ausente ou vazia. O CRM não pode iniciar sem ela.";
            console.error(errorMsg);
            setInitializationError(errorMsg);
            setIsAuthReady(true);
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authInstance = getAuth(app);
            setDb(firestore);

            console.log("Firebase inicializado. Iniciando autenticação...");
            
            const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                if (!user) {
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(authInstance, initialAuthToken);
                        } else {
                            await signInAnonymously(authInstance);
                        }
                    } catch (error) {
                        console.error("Erro ao autenticar, usando ID temporário:", error);
                        setUserId('auth-failed-' + crypto.randomUUID());
                    }
                } else {
                    setUserId(user.uid);
                }
                setIsAuthReady(true);
                console.log("Autenticação concluída. UserID:", user?.uid || 'Anônimo/Falha');
            });

            return () => unsubscribe();
        } catch (error) {
            const errorMsg = `Erro na inicialização do Firebase: ${error.message}. Verifique a sintaxe de __firebase_config.`;
            console.error(errorMsg, error);
            setInitializationError(errorMsg);
            setIsAuthReady(true);
        }
    }, []);
    
    // Handler para login bem-sucedido
    const handleLoginSuccess = (cnpj, name) => {
        setActiveCNPJ(cnpj);
        setCompanyName(name);
        setActiveTab('Leads'); 
        console.log(`Login bem-sucedido. Clínica ativa: ${name} (${cnpj})`);
    };

    // --- 2. Busca e Atualização em Tempo Real de Dados (FILTRADO POR CNPJ) ---
    const fetchData = useCallback(() => {
        if (!db || !userId || !activeCNPJ) {
             console.log("Aguardando DB, UserID ou CNPJ ativo para buscar dados. Abortando busca.");
             return;
        }
        setLoadingData(true);
        console.log(`Iniciando busca de dados para CNPJ: ${activeCNPJ} com UserID: ${userId}`);

        // A CORREÇÃO CRÍTICA: Mudar o caminho para a estrutura pública/compartilhada
        const COMPANY_ROOT = `artifacts/${appId}/public/data/companies/${activeCNPJ}`;
        
        const CLIENTS_PATH = `${COMPANY_ROOT}/clients`;
        const CONSULTATIONS_PATH = `${COMPANY_ROOT}/consultations`;
        const LEADS_COLLECTION_PATH = `artifacts/${appId}/public/data/leads`; // Continua o mesmo (público)

        const clientsRef = collection(db, CLIENTS_PATH);
        const consultationsRef = collection(db, CONSULTATIONS_PATH);
        const leadsRef = collection(db, LEADS_COLLECTION_PATH);

        // Listener para Clientes
        console.log(`Configurando listener para Clients: ${CLIENTS_PATH}`);
        const unsubscribeClients = onSnapshot(clientsRef, (snapshot) => {
            const clientList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            clientList.sort((a, b) => a.nome.localeCompare(b.nome));
            setClients(clientList);
            setLoadingData(false);
            console.log(`[CLIENTS SUCCESS] Clientes carregados: ${clientList.length}`);
            if (activeClient && activeClient.id !== 'new') {
                const updatedActiveClient = clientList.find(c => c.id === activeClient.id);
                if (updatedActiveClient) setActiveClient(updatedActiveClient); 
            }
        }, (error) => {
            console.error(`[CLIENTS ERROR] Falha ao carregar clientes. Path: ${CLIENTS_PATH}. Erro:`, error.message);
            setLoadingData(false);
        });

        // Listener para Consultas
        console.log(`Configurando listener para Consultations: ${CONSULTATIONS_PATH}`);
        const unsubscribeConsultations = onSnapshot(consultationsRef, (snapshot) => {
            const consultationList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setConsultations(consultationList);
             console.log(`[CONSULTATIONS SUCCESS] Consultas carregadas: ${consultationList.length}`);
        }, (error) => {
            console.error(`[CONSULTATIONS ERROR] Falha ao carregar consultas. Path: ${CONSULTATIONS_PATH}. Erro:`, error.message);
        });
        
        // Listener para Leads
        console.log(`Configurando listener para Leads: ${LEADS_COLLECTION_PATH} (Filtrando por CNPJ)`);
        const unsubscribeLeads = onSnapshot(leadsRef, (snapshot) => {
            const leadList = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(lead => lead.cnpj === activeCNPJ);
            setLeads(leadList);
             console.log(`[LEADS SUCCESS] Leads carregados e filtrados: ${leadList.length}`);
        }, (error) => {
            console.error(`[LEADS ERROR] Falha ao carregar leads. Path: ${LEADS_COLLECTION_PATH}. Erro:`, error.message);
        });


        return () => {
            console.log("Encerrando listeners do Firestore.");
            unsubscribeClients();
            unsubscribeConsultations();
            unsubscribeLeads();
        };
    }, [db, userId, activeCNPJ, activeClient]);

    useEffect(() => {
        if(activeCNPJ && isAuthReady) {
            const cleanup = fetchData();
            return cleanup;
        }
    }, [fetchData, activeCNPJ, isAuthReady]);


    // --- 3. Funções de Gestão de Leads (Inalteradas) ---

    const handleAcceptLead = async (lead) => {
        if (!db || !activeCNPJ) {
             console.error("DB ou CNPJ ausente. Não é possível aceitar o lead.");
             return;
        }

        // Usando o novo path corrigido
        const clientsRef = collection(db, `artifacts/${appId}/public/data/companies/${activeCNPJ}/clients`);
        const leadDocRef = doc(db, `artifacts/${appId}/public/data/leads`, lead.id);
        
        try {
            const newClientData = {
                nome: lead.nome,
                email: lead.email,
                telefone: lead.telefone,
                valorPadrao: 150.00,
                primeiraSessao: serverTimestamp(),
                createdAt: serverTimestamp(),
                origem: 'Landing Page Lead',
            };
            await addDoc(clientsRef, newClientData);
            
            await deleteDoc(leadDocRef);
            
            console.log(`Lead ${lead.nome} aceito e convertido para cliente!`);

        } catch (error) {
            console.error("Erro ao aceitar/converter lead:", error);
        }
    };
    
    const handleDeleteLead = async (leadId) => {
        if (!db) {
            console.error("DB ausente. Não é possível deletar o lead.");
            return;
        }
        
        const leadDocRef = doc(db, `artifacts/${appId}/public/data/leads`, leadId);
        try {
            await deleteDoc(leadDocRef);
            console.log(`Lead ${leadId} excluído com sucesso.`);
        } catch (error) {
            console.error("Erro ao deletar lead:", error);
        }
    };

    // --- RENDERIZAÇÃO DE ERRO CRÍTICO ---
    if (initializationError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
                <div className="bg-white p-8 rounded-xl shadow-2xl border-l-4 border-red-600 max-w-lg">
                    <h1 className="text-2xl font-bold text-red-700 mb-4">Falha Crítica ao Iniciar o CRM</h1>
                    <p className="text-gray-700 whitespace-pre-wrap">{initializationError}</p>
                    <p className="mt-4 text-sm text-red-500">
                        Isso geralmente indica um problema com as variáveis de ambiente `__firebase_config` fornecidas pelo sistema.
                    </p>
                </div>
            </div>
        );
    }

    // RENDERIZAÇÃO DE CARREGAMENTO
    if (!isAuthReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className={`text-xl font-semibold ${primaryTextColor}`}>
                    Autenticando...
                </p>
            </div>
        );
    }
    
    // RENDERIZAÇÃO DA TELA DE LOGIN
    if (!activeCNPJ) {
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }

    // --- Componentes e Lógica de Visualização (Omitidos por brevidade) ---

    // Consultas do cliente ativo (para detalhe)
    const clientConsultations = useMemo(() => {
        if (!activeClient || activeClient.id === 'new') return [];
        return consultations.filter(c => c.clientId === activeClient.id);
    }, [consultations, activeClient]);

    // Funções de navegação e modal
    const handleSelectClient = (client) => {
        setActiveClient(client);
        if (window.innerWidth < 768) { 
            setIsSidebarOpen(false);
        }
    };

    const handleOpenConsultationModal = (client = null) => {
        setClientForConsultation(client);
        setIsConsultationModalOpen(true);
    };
    
    const handleCloseSidebar = () => {
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };
    
    // Componentes Placeholder
    const ClientDetail = ({ onBack, client, onClientUpdate, onOpenConsultationModal, clientConsultations }) => (
        <div className="p-8">
            <button onClick={onBack} className="text-gray-600 hover:text-indigo-600 mb-4 flex items-center"><BackIcon className="w-5 h-5 mr-1" /> Voltar</button>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">{client?.nome || 'Novo Cliente (Detalhe Omitido)'}</h2>
            <p className="text-gray-600">O componente ClientDetail foi omitido nesta versão para focar na funcionalidade Multi-CNPJ e Leads. Utilize o código anterior para preencher esta seção.</p>
            <button 
                onClick={() => onOpenConsultationModal({id: client.id, nome: client.nome, valorPadrao: client.valorPadrao})} 
                className={`mt-4 text-white ${secondaryColor} font-semibold py-2 px-4 rounded-full shadow-md transition duration-150 flex items-center text-sm sm:text-base`}>
                <PlusIcon className="w-4 h-4 mr-2" />
                Nova Sessão
            </button>
            <div className="mt-8">
                <h3 className="text-xl font-semibold mb-3">Histórico de Sessões ({clientConsultations.length})</h3>
                {clientConsultations.length > 0 ? (
                    clientConsultations.map(c => <p key={c.id} className="text-sm border-b pb-1 mb-1">{formatDate(c.date)} - {formatCurrency(c.value)}</p>)
                ) : <p className="italic text-gray-500">Nenhuma sessão registrada.</p>}
            </div>
        </div>
    );

    const ClientsView = ({ clients, onSelectClient }) => (
        <div className="p-4 sm:p-6 md:p-8 h-full overflow-y-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 flex items-center">Clientes Ativos ({clients.length})</h2>
            {clients.length === 0 ? (
                <p className="text-gray-500 italic text-center mt-10">Nenhum cliente encontrado. Adicione um novo!</p>
            ) : (
                <ul className="space-y-3">
                    {clients.map(client => (
                        <li key={client.id} 
                            onClick={() => onSelectClient(client)}
                            className={`p-4 rounded-xl cursor-pointer shadow-md transition duration-150 bg-white hover:bg-indigo-50 border-l-4 border-transparent hover:border-indigo-600`}>
                            <p className="text-lg font-semibold text-gray-900 truncate">{client.nome}</p>
                            <p className="text-sm text-gray-500">
                                {client.telefone || client.email || 'Detalhes pendentes'} | {formatCurrency(client.valorPadrao)}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    const LeadsView = ({ activeCNPJ, leads, onAcceptLead, onDeleteLead }) => {
        const handleAccept = (lead) => {
            const shouldAccept = true;
            console.log(`Tentativa de aceitar o lead ${lead.nome}.`);
            if (shouldAccept) onAcceptLead(lead);
        };
        
        const handleDelete = (lead) => {
            const shouldDelete = true;
            console.log(`Tentativa de DELETAR o lead ${lead.nome}.`);
            if (shouldDelete) onDeleteLead(lead.id);
        };
        
        const sortedLeads = useMemo(() => {
            return leads.slice().sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
        }, [leads]);


        return (
            <div className="p-4 sm:p-6 md:p-8 h-full overflow-y-auto">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 flex items-center">
                    <MailIcon className="w-6 h-6 mr-2" />
                    Novos Leads ({leads.length})
                </h2>
                <p className="text-sm text-gray-500 mb-6">Contatos recebidos da landing page para {activeCNPJ}.</p>

                {leads.length === 0 ? (
                    <p className="text-gray-500 italic text-center mt-10">Nenhum novo lead encontrado para esta clínica.</p>
                ) : (
                    <ul className="space-y-4">
                        {sortedLeads.map(lead => (
                            <li key={lead.id} className="bg-white p-5 rounded-xl shadow border-l-4 border-pink-500">
                                <div className="flex justify-between items-start mb-2 border-b pb-2 flex-col sm:flex-row">
                                    <span className="text-lg font-semibold text-gray-900 truncate max-w-[80%]">{lead.nome}</span>
                                    <span className="text-sm text-gray-500 whitespace-nowrap">
                                        Recebido em: {formatDate(lead.createdAt)}
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700 mb-4">
                                    <p><strong>E-mail:</strong> {lead.email}</p>
                                    <p><strong>Telefone:</strong> {lead.telefone}</p>
                                </div>
                                
                                <div className="flex justify-end space-x-2">
                                    <button
                                        onClick={() => handleDelete(lead)}
                                        className="px-3 py-1 text-sm bg-red-100 text-red-600 font-semibold rounded-full hover:bg-red-200 transition"
                                    >
                                        Excluir
                                    </button>
                                    <button
                                        onClick={() => handleAccept(lead)}
                                        className="px-3 py-1 text-sm bg-green-500 text-white font-semibold rounded-full hover:bg-green-600 transition"
                                    >
                                        Aceitar e Converter em Cliente
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    };

    const NewConsultationModal = ({ onClose }) => (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div onClick={e => e.stopPropagation()} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md">
                <h3 className="text-2xl font-bold text-secondary mb-6">Registrar Sessão (Omitido)</h3>
                <p className="text-gray-600">O modal foi omitido nesta versão. Use o código da implementação anterior.</p>
                <button type="button" onClick={onClose} className="mt-6 w-full px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition">
                    Fechar
                </button>
            </div>
        </div>
    );
    
    const ClientDisplay = activeClient && (
        <ClientDetail 
            client={activeClient.id !== 'new' ? activeClient : null}
            onBack={() => setActiveClient(null)}
            onOpenConsultationModal={handleOpenConsultationModal}
            clientConsultations={clientConsultations}
        />
    );
    
    const TabContent = () => {
        // Exibe um spinner de carregamento se os dados estiverem sendo buscados
        if (loadingData) {
            return (
                <div className="flex items-center justify-center h-full p-10">
                    <div className="flex flex-col items-center">
                        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${primaryTextColor} border-t-2 border-r-2 border-indigo-200`}></div>
                        <p className={`mt-4 text-lg font-semibold ${primaryTextColor}`}>Carregando dados da clínica...</p>
                    </div>
                </div>
            );
        }

        switch (activeTab) {
            case 'Clients':
                return <ClientsView clients={clients} onSelectClient={handleSelectClient} />;
            case 'Leads':
                return (
                    <LeadsView 
                        activeCNPJ={activeCNPJ} 
                        leads={leads} 
                        onAcceptLead={handleAcceptLead}
                        onDeleteLead={handleDeleteLead}
                    />
                );
            case 'Consultations':
                return <p className="p-10 text-gray-500 italic">Visualização de Consultas (Omitido por brevidade).</p>;
            case 'Dashboard':
                 return <p className="p-10 text-gray-500 italic">Dashboard Analítico (Omitido por brevidade).</p>;
            default:
                return null;
        }
    };
    
    const navItems = [
        { name: 'Leads', icon: MailIcon, label: 'Novos Leads' },
        { name: 'Clients', icon: UserIcon, label: 'Clientes Ativos' },
        { name: 'Consultations', icon: CalendarIcon, label: 'Sessões' },
        { name: 'Dashboard', icon: ChartIcon, label: 'Dashboard' },
    ];
    
    const sidebarWidthClass = isSidebarOpen ? 'w-64' : 'w-20';
    const mainContentMarginClass = isSidebarOpen ? 'md:ml-64' : 'md:ml-20';

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            
            {/* Sidebar */}
            <aside className={`fixed h-full bg-white shadow-xl z-50 transition-all duration-300 
                              ${sidebarWidthClass} 
                              ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                              md:translate-x-0`}>
                
                {/* Cabeçalho da Sidebar */}
                <div className={`p-4 flex items-center justify-between border-b ${isSidebarOpen ? '' : 'justify-center'}`}>
                    {isSidebarOpen ? (
                        <h1 className="text-2xl font-extrabold text-gray-900">
                            <span className={primaryTextColor}>Psico</span>CRM
                        </h1>
                    ) : (
                        <h1 className={`text-2xl font-extrabold ${primaryTextColor}`}>P</h1>
                    )}
                    <button 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                        className={`p-1 rounded-full text-gray-600 hover:bg-gray-100 transition hidden md:block`}
                        title={isSidebarOpen ? 'Ocultar Menu' : 'Expandir Menu'}>
                        {isSidebarOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
                    </button>
                     <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-1 rounded-full text-gray-600 hover:bg-gray-100 transition">
                        {isSidebarOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
                    </button>
                </div>

                {isSidebarOpen && (
                    <div className="p-4 bg-indigo-50 border-b">
                        <p className="text-xs font-semibold text-indigo-800">Clínica Ativa:</p>
                        <p className="text-sm font-bold text-indigo-900">{companyName}</p>
                    </div>
                )}

                {/* Itens de Navegação */}
                <nav className="p-2 space-y-2 mt-4">
                    {navItems.map(item => (
                        <button
                            key={item.name}
                            onClick={() => { setActiveTab(item.name); setActiveClient(null); handleCloseSidebar(); }}
                            className={`w-full flex items-center ${isSidebarOpen ? 'px-4' : 'justify-center'} py-3 rounded-xl transition duration-150 
                                        ${activeTab === item.name 
                                            ? `text-white ${primaryColor} shadow-md` 
                                            : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                                        }`}
                        >
                            <item.icon className={`w-6 h-6 ${isSidebarOpen ? 'mr-3' : ''}`} />
                            {isSidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
                        </button>
                    ))}
                    
                    {/* Botão de Novo Cliente */}
                    <button
                        onClick={() => { handleSelectClient({ id: 'new' }); handleCloseSidebar(); }}
                        className={`w-full flex items-center ${isSidebarOpen ? 'px-4' : 'justify-center'} py-3 rounded-xl transition duration-150 mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold`}
                    >
                        <UserIcon className={`w-6 h-6 ${isSidebarOpen ? 'mr-3' : ''}`} />
                        {isSidebarOpen && <span className="whitespace-nowrap">Novo Cliente</span>}
                    </button>
                </nav>
                
                {/* ID de Usuário no Rodapé */}
                {isSidebarOpen && (
                    <div className="absolute bottom-0 p-4 w-full text-xs text-gray-400 border-t">
                        <p className="font-semibold">ID Usuário:</p>
                        <p className="break-all">{userId}</p>
                        <button onClick={() => setActiveCNPJ(null)} className="mt-2 text-indigo-500 hover:text-indigo-700">Sair/Mudar Clínica</button>
                    </div>
                )}
            </aside>
            
            {/* Overlay para Mobile quando a Sidebar está aberta */}
            {isSidebarOpen && window.innerWidth < 768 && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsSidebarOpen(false)}></div>
            )}


            {/* Main Content Area */}
            <main className={`flex-1 transition-all duration-300 overflow-y-auto ${mainContentMarginClass}`}>
                
                {/* Header Superior (apenas para mobile e ações) */}
                <header className="sticky top-0 p-4 bg-white shadow-md flex justify-between items-center md:hidden z-30">
                    <button 
                        onClick={() => setIsSidebarOpen(true)} 
                        className="p-1 rounded-full text-gray-600 hover:bg-gray-100">
                        <MenuIcon className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-extrabold text-gray-900">
                        <span className={primaryTextColor}>Psico</span>CRM
                    </h1>
                    <button 
                        onClick={() => handleOpenConsultationModal()} 
                        className={`p-2 rounded-full text-white ${secondaryColor} shadow-md`}>
                        <PlusIcon className="w-5 h-5" />
                    </button>
                </header>

                {/* Conteúdo da Tab/Detalhe do Cliente */}
                <section className="min-h-[calc(100vh-64px)] md:min-h-screen">
                    {activeClient ? ClientDisplay : <TabContent />}
                </section>
                
                {/* Floating Action Button (FAB) para Desktop/Tablet */}
                {!activeClient && (
                    <button 
                        onClick={() => handleOpenConsultationModal()} 
                        className={`hidden md:flex fixed bottom-6 right-6 p-4 rounded-full text-white ${secondaryColor} shadow-lg text-lg font-bold items-center transition transform hover:scale-105 z-40`}>
                        <PlusIcon className="w-6 h-6 mr-2" />
                        Nova Sessão
                    </button>
                )}

            </main>
            
            {/* Modal de Nova Consulta */}
            {isConsultationModalOpen && (
                <NewConsultationModal 
                    onClose={() => {setIsConsultationModalOpen(false); setClientForConsultation(null);}}
                />
            )}
        </div>
    );
};

export default App;
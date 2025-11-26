import { html, render, useState, useEffect } from 'https://esm.sh/htm/preact/standalone';

// ============================================
// CONFIGURAZIONE API
// ============================================
const API_URL = 'https://disidratazione-backend.aziendamalbosca.workers.dev';

// ============================================
// UTILITY FUNCTIONS
// ============================================

const calcolaOreManodopera = (oraInizio, oraFine, persone) => {
    if (!oraInizio || !oraFine) return 0;
    const [hI, mI] = oraInizio.split(':').map(Number);
    const [hF, mF] = oraFine.split(':').map(Number);
    const minuti = (hF * 60 + mF) - (hI * 60 + mI);
    return (minuti / 60) * persone;
};

const calcolaOreMacchina = (oraAccensione, oraSpegnimento) => {
    if (!oraAccensione || !oraSpegnimento) return 0;
    const [hA, mA] = oraAccensione.split(':').map(Number);
    const [hS, mS] = oraSpegnimento.split(':').map(Number);
    const minuti = (hS * 60 + mS) - (hA * 60 + mA);
    return minuti / 60;
};

const formatOre = (ore) => {
    return ore.toFixed(2) + ' h';
};

// ============================================
// API FUNCTIONS
// ============================================

const API = {
    async caricaLavorazioni() {
        try {
            const response = await fetch(`${API_URL}/lavorazioni`);
            if (!response.ok) throw new Error('Errore caricamento');
            return await response.json();
        } catch (error) {
            console.error('Errore API:', error);
            const stored = localStorage.getItem('lavorazioni');
            return stored ? JSON.parse(stored) : [];
        }
    },

    async salvaLavorazione(lavorazione) {
        try {
            const response = await fetch(`${API_URL}/lavorazioni`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lavorazione)
            });
            if (!response.ok) throw new Error('Errore salvataggio');
            
            const lavorazioni = await this.caricaLavorazioni();
            const index = lavorazioni.findIndex(l => l.id === lavorazione.id);
            if (index >= 0) {
                lavorazioni[index] = lavorazione;
            } else {
                lavorazioni.push(lavorazione);
            }
            localStorage.setItem('lavorazioni', JSON.stringify(lavorazioni));
            
            return true;
        } catch (error) {
            console.error('Errore salvataggio:', error);
            return false;
        }
    },

    async eliminaLavorazione(id) {
        try {
            const response = await fetch(`${API_URL}/lavorazioni/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Errore eliminazione');
            
            const lavorazioni = await this.caricaLavorazioni();
            const nuove = lavorazioni.filter(l => l.id !== id);
            localStorage.setItem('lavorazioni', JSON.stringify(nuove));
            
            return true;
        } catch (error) {
            console.error('Errore eliminazione:', error);
            return false;
        }
    },

    async creaLotto(datiLotto) {
        try {
            const response = await fetch(`${API_URL}/crea-lotto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datiLotto)
            });
            if (!response.ok) throw new Error('Errore creazione lotto');
            return await response.json();
        } catch (error) {
            console.error('Errore creazione lotto:', error);
            return { success: false, error: error.message };
        }
    },

    async caricaPulizieHACCP() {
        try {
            const response = await fetch(`${API_URL}/pulizie-haccp`);
            if (!response.ok) throw new Error('Errore caricamento pulizie HACCP');
            return await response.json();
        } catch (error) {
            console.error('Errore API:', error);
            return [];
        }
    },

    async salvaPuliziaHACCP(pulizia) {
        try {
            const response = await fetch(`${API_URL}/pulizie-haccp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pulizia)
            });
            if (!response.ok) throw new Error('Errore salvataggio pulizia HACCP');
            return true;
        } catch (error) {
            console.error('Errore salvataggio pulizia HACCP:', error);
            return false;
        }
    },

    async eliminaPuliziaHACCP(id) {
        try {
            const response = await fetch(`${API_URL}/pulizie-haccp/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Errore eliminazione pulizia HACCP');
            return true;
        } catch (error) {
            console.error('Errore eliminazione pulizia HACCP:', error);
            return false;
        }
    }
};

// ============================================
// MAIN APP COMPONENT
// ============================================

function App() {
    const [lavorazioni, setLavorazioni] = useState([]);
    const [currentLavorazione, setCurrentLavorazione] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [online, setOnline] = useState(navigator.onLine);
    const [kgSecco, setKgSecco] = useState('');
    const [showReport, setShowReport] = useState(false);
    const [categoriaLotto, setCategoriaLotto] = useState('frutta');
    const [creatingLotto, setCreatingLotto] = useState(false);
    const [showPulizieHACCP, setShowPulizieHACCP] = useState(false);
    const [pulizieHACCP, setPulizieHACCP] = useState([]);
    const [puliziaHACCPForm, setPuliziaHACCPForm] = useState({
        data: new Date().toISOString().split('T')[0],
        locale: 'Laboratorio',
        spazzaturaPavimento: false,
        lavaggioPavimentoDetergente: false,
        controlloRagnatele: false,
        prodottoUtilizzato: '',
        angoliScaffali: 'Puliti',
        esito: 'Conforme',
        noteNonConformita: '',
        operatore: 'Emanuele Visigalli'
    });

    const [formData, setFormData] = useState({
        prodotto: '',
        fornitore: '',
        kgAcquistati: '',
        dataInizio: new Date().toISOString().split('T')[0],
    });

    const [attivitaGiornaliera, setAttivitaGiornaliera] = useState({
        data: new Date().toISOString().split('T')[0],
        oraInizioLavoro: '',
        oraFineLavoro: '',
        numeroPersone: 1,
        oraAccensione40: '',
        oraSpegnimento40: '',
        oraAccensione100: '',
        oraSpegnimento100: '',
        pulizie: {
            pianoLavoro: false,
            lavello: false,
            tagliaverdure: false,
            scopatoPavimento: false,
            lavatoPavimento: false,
            disidratatore: false,
            ceste: false,
            retine: false
        },
        note: ''
    });

    useEffect(() => {
        caricaDati();
        caricaPulizieHACCP();
        
        window.addEventListener('online', () => setOnline(true));
        window.addEventListener('offline', () => setOnline(false));
    }, []);

    const caricaDati = async () => {
        setLoading(true);
        const lav = await API.caricaLavorazioni();
        setLavorazioni(lav);
        setLoading(false);
    };

    const caricaPulizieHACCP = async () => {
        const pulizie = await API.caricaPulizieHACCP();
        setPulizieHACCP(pulizie);
    };

    const salvaPuliziaHACCP = async () => {
        if (!puliziaHACCPForm.data) {
            alert('Inserisci la data');
            return;
        }

        const nuovaPulizia = {
            id: 'HACCP_' + Date.now(),
            ...puliziaHACCPForm
        };

        const success = await API.salvaPuliziaHACCP(nuovaPulizia);
        
        if (success) {
            alert('✅ Pulizia HACCP registrata!');
            await caricaPulizieHACCP();
            setPuliziaHACCPForm({
                data: new Date().toISOString().split('T')[0],
                locale: 'Laboratorio',
                spazzaturaPavimento: false,
                lavaggioPavimentoDetergente: false,
                controlloRagnatele: false,
                prodottoUtilizzato: '',
                angoliScaffali: 'Puliti',
                esito: 'Conforme',
                noteNonConformita: '',
                operatore: 'Emanuele Visigalli'
            });
            setShowPulizieHACCP(false);
        } else {
            alert('❌ Errore salvataggio');
        }
    };

    const avviaNuovaLavorazione = async () => {
        if (!formData.prodotto || !formData.fornitore || !formData.kgAcquistati) {
            alert('Compila tutti i campi obbligatori');
            return;
        }

        const nuovaLav = {
            id: 'LAV_' + Date.now(),
            ...formData,
            attivita: [],
            completata: false,
            kgSecco: '',
            oreManooperaTotali: 0,
            oreMacchinaTotali: 0
        };

        await API.salvaLavorazione(nuovaLav);
        await caricaDati();
        
        setCurrentLavorazione(nuovaLav);
        setFormData({
            prodotto: '',
            fornitore: '',
            kgAcquistati: '',
            dataInizio: new Date().toISOString().split('T')[0]
        });
        setShowForm(false);
    };

    const aggiungiAttivita = async () => {
        if (!currentLavorazione) return;
        if (!attivitaGiornaliera.data) {
            alert('Inserisci almeno la data');
            return;
        }

        const nuovaAttivita = {
            id: 'ATT_' + Date.now(),
            ...attivitaGiornaliera
        };

        const lavorazioneAggiornata = {
            ...currentLavorazione,
            attivita: [...currentLavorazione.attivita, nuovaAttivita]
        };

        await API.salvaLavorazione(lavorazioneAggiornata);
        await caricaDati();

        setAttivitaGiornaliera({
            data: new Date(new Date(attivitaGiornaliera.data).getTime() + 86400000).toISOString().split('T')[0],
            oraInizioLavoro: '',
            oraFineLavoro: '',
            numeroPersone: 1,
            oraAccensione40: '',
            oraSpegnimento40: '',
            oraAccensione100: '',
            oraSpegnimento100: '',
            pulizie: {
                pianoLavoro: false,
                lavello: false,
                tagliaverdure: false,
                scopatoPavimento: false,
                lavatoPavimento: false,
                disidratatore: false,
                ceste: false,
                retine: false
            },
            note: ''
        });
        
        setCurrentLavorazione(null);
    };

    const completaLavorazione = async () => {
        if (!currentLavorazione) return;
        
        const haSpegnimento = currentLavorazione.attivita.some(
            att => att.oraSpegnimento40 || att.oraSpegnimento100
        );

        if (!haSpegnimento) {
            alert('Devi inserire almeno un orario di spegnimento del disidratatore!');
            return;
        }

        if (!kgSecco) {
            alert('Inserisci i kg di prodotto secco ottenuto');
            return;
        }

        setCreatingLotto(true);

        let oreManooperaTotali = 0;
        let oreDisidratatore40 = 0;
        let oreDisidratatore100 = 0;

        currentLavorazione.attivita.forEach(att => {
            oreManooperaTotali += calcolaOreManodopera(att.oraInizioLavoro, att.oraFineLavoro, att.numeroPersone);
            oreDisidratatore40 += calcolaOreMacchina(att.oraAccensione40, att.oraSpegnimento40);
            oreDisidratatore100 += calcolaOreMacchina(att.oraAccensione100, att.oraSpegnimento100);
        });

        const oreMacchinaTotali = oreDisidratatore40 + oreDisidratatore100;

        const lavorazioneCompletata = {
            ...currentLavorazione,
            completata: true,
            kgSecco: kgSecco,
            oreManooperaTotali: oreManooperaTotali,
            oreMacchinaTotali: oreMacchinaTotali
        };

        await API.salvaLavorazione(lavorazioneCompletata);

        // Crea il lotto automaticamente
        const datiLotto = {
            prodotto: currentLavorazione.prodotto,
            fornitore: currentLavorazione.fornitore,
            dataInizio: currentLavorazione.dataInizio,
            kgFreschi: currentLavorazione.kgAcquistati,
            kgSecco: kgSecco,
            oreManodopera: oreManooperaTotali,
            oreDisidratatore40: oreDisidratatore40,
            oreDisidratatore100: oreDisidratatore100,
            categoria: categoriaLotto
        };

        const risultatoLotto = await API.creaLotto(datiLotto);
        
        setCreatingLotto(false);

        if (risultatoLotto.success) {
            alert(`✅ Lavorazione completata!\n\n📦 Lotto ${risultatoLotto.lotNumber} creato automaticamente nel foglio Lotti!`);
        } else {
            alert(`✅ Lavorazione completata!\n\n⚠️ Errore creazione lotto: ${risultatoLotto.error}\n\nPuoi crearlo manualmente.`);
        }

        await caricaDati();
        
        setCurrentLavorazione(null);
        setKgSecco('');
        setCategoriaLotto('frutta');
    };

    const riprendiLavorazione = (lav) => {
        setCurrentLavorazione(lav);
        setKgSecco(lav.kgSecco || '');
    };

    const eliminaLavorazione = async (id) => {
        if (!confirm('Sei sicuro di voler eliminare questa lavorazione?')) return;
        
        await API.eliminaLavorazione(id);
        await caricaDati();
        
        if (currentLavorazione?.id === id) {
            setCurrentLavorazione(null);
        }
    };

    if (loading) {
        return html`
            <div class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
                <div class="text-center">
                    <div class="text-4xl mb-4">⏳</div>
                    <p class="text-gray-600">Caricamento in corso...</p>
                </div>
            </div>
        `;
    }

    return html`
        <div class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 pb-20">
            <div class="max-w-7xl mx-auto">
                <!-- Header -->
                <div class="bg-white rounded-xl shadow-lg p-4 mb-4">
                    <div class="flex justify-between items-center">
                        <div>
                            <h1 class="text-xl md:text-2xl font-bold text-green-800">
                                🥕 Disidratazione
                            </h1>
                            <p class="text-xs text-gray-500">Tracciamento lavorazioni</p>
                        </div>
                        ${online ? html`
                            <span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                                ● Online
                            </span>
                        ` : html`
                            <span class="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-medium">
                                ● Offline
                            </span>
                        `}
                    </div>
                </div>

                <!-- Pulsanti Azione -->
                <div class="grid grid-cols-3 gap-2 mb-4">
                    <button
                        onClick=${() => { setShowForm(!showForm); setShowReport(false); setShowPulizieHACCP(false); }}
                        class="${`flex items-center justify-center gap-1 px-3 py-3 rounded-xl font-medium shadow-md transition-all text-sm ${showForm ? 'bg-gray-500 hover:bg-gray-600' : 'bg-green-600 hover:bg-green-700'} text-white`}"
                    >
                        ${showForm ? '✕' : '➕'} Nuova
                    </button>
                    <button
                        onClick=${() => { setShowReport(!showReport); setShowForm(false); setShowPulizieHACCP(false); }}
                        class="${`flex items-center justify-center gap-1 px-3 py-3 rounded-xl font-medium shadow-md transition-all text-sm ${showReport ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'} text-white`}"
                    >
                        ${showReport ? '✕' : '📊'} Report
                    </button>
                    <button
                        onClick=${() => { setShowPulizieHACCP(!showPulizieHACCP); setShowForm(false); setShowReport(false); }}
                        class="${`flex items-center justify-center gap-1 px-3 py-3 rounded-xl font-medium shadow-md transition-all text-sm ${showPulizieHACCP ? 'bg-gray-500 hover:bg-gray-600' : 'bg-amber-600 hover:bg-amber-700'} text-white`}"
                    >
                        ${showPulizieHACCP ? '✕' : '🧹'} HACCP
                    </button>
                </div>

                <!-- Form Pulizie HACCP -->
                ${showPulizieHACCP && html`
                    <div class="bg-white rounded-xl shadow-lg p-4 mb-4 border-2 border-amber-400">
                        <h2 class="text-lg font-bold text-amber-800 mb-4">🧹 Pulizie Approfondite HACCP</h2>
                        
                        <div class="space-y-4">
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                                    <input
                                        type="date"
                                        value=${puliziaHACCPForm.data}
                                        onInput=${(e) => setPuliziaHACCPForm({...puliziaHACCPForm, data: e.target.value})}
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Locale *</label>
                                    <select
                                        value=${puliziaHACCPForm.locale}
                                        onChange=${(e) => setPuliziaHACCPForm({...puliziaHACCPForm, locale: e.target.value})}
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="Laboratorio">🏭 Laboratorio</option>
                                        <option value="Magazzino">📦 Magazzino</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <h4 class="font-medium text-gray-700 mb-2 text-sm">Operazioni effettuate</h4>
                                <div class="grid grid-cols-1 gap-2">
                                    <label class="flex items-center space-x-3 cursor-pointer bg-gray-50 p-2 rounded-lg">
                                        <input
                                            type="checkbox"
                                            checked=${puliziaHACCPForm.spazzaturaPavimento}
                                            onChange=${(e) => setPuliziaHACCPForm({...puliziaHACCPForm, spazzaturaPavimento: e.target.checked})}
                                            class="w-5 h-5"
                                        />
                                        <span class="text-sm">🧹 Spazzatura pavimento</span>
                                    </label>
                                    <label class="flex items-center space-x-3 cursor-pointer bg-gray-50 p-2 rounded-lg">
                                        <input
                                            type="checkbox"
                                            checked=${puliziaHACCPForm.lavaggioPavimentoDetergente}
                                            onChange=${(e) => setPuliziaHACCPForm({...puliziaHACCPForm, lavaggioPavimentoDetergente: e.target.checked})}
                                            class="w-5 h-5"
                                        />
                                        <span class="text-sm">🧴 Lavaggio pavimento con detergente</span>
                                    </label>
                                    <label class="flex items-center space-x-3 cursor-pointer bg-gray-50 p-2 rounded-lg">
                                        <input
                                            type="checkbox"
                                            checked=${puliziaHACCPForm.controlloRagnatele}
                                            onChange=${(e) => setPuliziaHACCPForm({...puliziaHACCPForm, controlloRagnatele: e.target.checked})}
                                            class="w-5 h-5"
                                        />
                                        <span class="text-sm">🕸️ Controllo e pulizia ragnatele</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Prodotto utilizzato</label>
                                <input
                                    type="text"
                                    value=${puliziaHACCPForm.prodottoUtilizzato}
                                    onInput=${(e) => setPuliziaHACCPForm({...puliziaHACCPForm, prodottoUtilizzato: e.target.value})}
                                    placeholder="Es: Detergente XYZ"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                            
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Angoli/Scaffali</label>
                                    <select
                                        value=${puliziaHACCPForm.angoliScaffali}
                                        onChange=${(e) => setPuliziaHACCPForm({...puliziaHACCPForm, angoliScaffali: e.target.value})}
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="Puliti">✅ Puliti</option>
                                        <option value="Non necessario">➖ Non necessario</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Esito</label>
                                    <select
                                        value=${puliziaHACCPForm.esito}
                                        onChange=${(e) => setPuliziaHACCPForm({...puliziaHACCPForm, esito: e.target.value})}
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="Conforme">✅ Conforme</option>
                                        <option value="Non conforme">❌ Non conforme</option>
                                    </select>
                                </div>
                            </div>
                            
                            ${puliziaHACCPForm.esito === 'Non conforme' && html`
                                <div>
                                    <label class="block text-sm font-medium text-red-700 mb-1">Note non conformità *</label>
                                    <textarea
                                        value=${puliziaHACCPForm.noteNonConformita}
                                        onInput=${(e) => setPuliziaHACCPForm({...puliziaHACCPForm, noteNonConformita: e.target.value})}
                                        placeholder="Descrivi il problema riscontrato..."
                                        rows="2"
                                        class="w-full px-3 py-2 border border-red-300 rounded-lg text-sm bg-red-50"
                                    />
                                </div>
                            `}
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Operatore</label>
                                <input
                                    type="text"
                                    value=${puliziaHACCPForm.operatore}
                                    onInput=${(e) => setPuliziaHACCPForm({...puliziaHACCPForm, operatore: e.target.value})}
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                        </div>
                        
                        <button
                            onClick=${salvaPuliziaHACCP}
                            class="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-xl font-medium"
                        >
                            ✅ Registra Pulizia HACCP
                        </button>
                        
                        <!-- Storico pulizie HACCP -->
                        ${pulizieHACCP.length > 0 && html`
                            <div class="mt-4 pt-4 border-t border-amber-200">
                                <h3 class="font-medium text-gray-700 mb-2 text-sm">📋 Ultime registrazioni</h3>
                                <div class="space-y-2 max-h-40 overflow-y-auto">
                                    ${pulizieHACCP
                                        .sort((a, b) => new Date(b.data) - new Date(a.data))
                                        .slice(0, 5)
                                        .map(p => html`
                                            <div class="bg-amber-50 p-2 rounded-lg text-xs flex justify-between items-center">
                                                <div>
                                                    <span class="font-medium">${new Date(p.data).toLocaleDateString('it-IT')}</span>
                                                    <span class="text-gray-500 ml-2">${p.locale}</span>
                                                    <span class="${p.esito === 'Conforme' ? 'text-green-600' : 'text-red-600'} ml-2">${p.esito === 'Conforme' ? '✅' : '❌'}</span>
                                                </div>
                                            </div>
                                        `)
                                    }
                                </div>
                            </div>
                        `}
                    </div>
                `}

                <!-- Form nuova lavorazione -->
                ${showForm && html`
                    <div class="bg-white rounded-lg shadow-lg p-4 mb-4">
                        <h2 class="text-xl font-bold text-gray-800 mb-4">Nuova Lavorazione</h2>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Prodotto *</label>
                                <input
                                    type="text"
                                    value=${formData.prodotto}
                                    onInput=${(e) => setFormData({...formData, prodotto: e.target.value})}
                                    placeholder="Es: Mele, Pomodori..."
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Fornitore *</label>
                                <input
                                    type="text"
                                    value=${formData.fornitore}
                                    onInput=${(e) => setFormData({...formData, fornitore: e.target.value})}
                                    placeholder="Nome fornitore"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Kg Acquistati *</label>
                                <input
                                    type="number"
                                    value=${formData.kgAcquistati}
                                    onInput=${(e) => setFormData({...formData, kgAcquistati: e.target.value})}
                                    placeholder="100"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                                <input
                                    type="date"
                                    value=${formData.dataInizio}
                                    onInput=${(e) => setFormData({...formData, dataInizio: e.target.value})}
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <button
                            onClick=${avviaNuovaLavorazione}
                            class="mt-4 w-full md:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium"
                        >
                            Avvia Lavorazione
                        </button>
                    </div>
                `}

                <!-- Report e Statistiche -->
                ${showReport && html`
                    <div class="bg-white rounded-lg shadow-lg p-4 mb-4">
                        <h2 class="text-xl font-bold text-gray-800 mb-4">📊 Report e Statistiche</h2>
                        
                        ${(() => {
                            const completate = lavorazioni.filter(l => l.completata);
                            const totKgFreschi = completate.reduce((sum, l) => sum + (parseFloat(l.kgAcquistati) || 0), 0);
                            const totKgSecchi = completate.reduce((sum, l) => sum + (parseFloat(l.kgSecco) || 0), 0);
                            const totOreManodopera = completate.reduce((sum, l) => sum + (l.oreManooperaTotali || 0), 0);
                            const totOreMacchina = completate.reduce((sum, l) => sum + (l.oreMacchinaTotali || 0), 0);
                            const resaMedia = totKgFreschi > 0 ? ((totKgSecchi / totKgFreschi) * 100).toFixed(1) : 0;
                            
                            const perProdotto = {};
                            completate.forEach(l => {
                                const prod = l.prodotto || 'Sconosciuto';
                                if (!perProdotto[prod]) {
                                    perProdotto[prod] = { kgFreschi: 0, kgSecchi: 0, count: 0 };
                                }
                                perProdotto[prod].kgFreschi += parseFloat(l.kgAcquistati) || 0;
                                perProdotto[prod].kgSecchi += parseFloat(l.kgSecco) || 0;
                                perProdotto[prod].count += 1;
                            });
                            
                            const perFornitore = {};
                            completate.forEach(l => {
                                const forn = l.fornitore || 'Sconosciuto';
                                if (!perFornitore[forn]) {
                                    perFornitore[forn] = { kgFreschi: 0, count: 0 };
                                }
                                perFornitore[forn].kgFreschi += parseFloat(l.kgAcquistati) || 0;
                                perFornitore[forn].count += 1;
                            });
                            
                            const oggi = new Date();
                            const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
                            const questoMese = completate.filter(l => new Date(l.dataInizio) >= inizioMese);
                            const kgMese = questoMese.reduce((sum, l) => sum + (parseFloat(l.kgAcquistati) || 0), 0);
                            
                            const inizioAnno = new Date(oggi.getFullYear(), 0, 1);
                            const questAnno = completate.filter(l => new Date(l.dataInizio) >= inizioAnno);
                            const kgAnnoFreschi = questAnno.reduce((sum, l) => sum + (parseFloat(l.kgAcquistati) || 0), 0);
                            const kgAnnoSecchi = questAnno.reduce((sum, l) => sum + (parseFloat(l.kgSecco) || 0), 0);
                            const oreManodoperaAnno = questAnno.reduce((sum, l) => sum + (l.oreManooperaTotali || 0), 0);
                            const oreMacchinaAnno = questAnno.reduce((sum, l) => sum + (l.oreMacchinaTotali || 0), 0);
                            const resaAnno = kgAnnoFreschi > 0 ? ((kgAnnoSecchi / kgAnnoFreschi) * 100).toFixed(1) : 0;
                            
                            return html`
                                <!-- Statistiche Generali -->
                                <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                                    <div class="bg-green-50 p-3 rounded-lg text-center">
                                        <div class="text-2xl font-bold text-green-600">${completate.length}</div>
                                        <div class="text-xs text-gray-600">Lavorazioni completate</div>
                                    </div>
                                    <div class="bg-blue-50 p-3 rounded-lg text-center">
                                        <div class="text-2xl font-bold text-blue-600">${totKgFreschi.toFixed(0)}</div>
                                        <div class="text-xs text-gray-600">Kg freschi totali</div>
                                    </div>
                                    <div class="bg-purple-50 p-3 rounded-lg text-center">
                                        <div class="text-2xl font-bold text-purple-600">${totKgSecchi.toFixed(1)}</div>
                                        <div class="text-xs text-gray-600">Kg secchi totali</div>
                                    </div>
                                    <div class="bg-yellow-50 p-3 rounded-lg text-center">
                                        <div class="text-2xl font-bold text-yellow-600">${resaMedia}%</div>
                                        <div class="text-xs text-gray-600">Resa media</div>
                                    </div>
                                    <div class="bg-orange-50 p-3 rounded-lg text-center">
                                        <div class="text-2xl font-bold text-orange-600">${totOreManodopera.toFixed(1)}</div>
                                        <div class="text-xs text-gray-600">Ore manodopera</div>
                                    </div>
                                    <div class="bg-red-50 p-3 rounded-lg text-center">
                                        <div class="text-2xl font-bold text-red-600">${totOreMacchina.toFixed(1)}</div>
                                        <div class="text-xs text-gray-600">Ore macchina</div>
                                    </div>
                                </div>
                                
                                <!-- Quest'anno -->
                                <div class="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg mb-4 border border-green-200">
                                    <h3 class="font-bold text-gray-700 mb-3">📅 Anno ${oggi.getFullYear()}</h3>
                                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div class="text-center">
                                            <div class="text-xl font-bold text-green-600">${questAnno.length}</div>
                                            <div class="text-xs text-gray-600">Lavorazioni</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-xl font-bold text-blue-600">${kgAnnoFreschi.toFixed(0)} kg</div>
                                            <div class="text-xs text-gray-600">Freschi</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-xl font-bold text-orange-600">${oreManodoperaAnno.toFixed(1)} h</div>
                                            <div class="text-xs text-gray-600">Manodopera</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-xl font-bold text-red-600">${oreMacchinaAnno.toFixed(1)} h</div>
                                            <div class="text-xs text-gray-600">Macchina</div>
                                        </div>
                                    </div>
                                    <div class="mt-3 pt-3 border-t border-green-200 flex justify-between text-sm">
                                        <span>Kg secchi: <strong>${kgAnnoSecchi.toFixed(1)}</strong></span>
                                        <span>Resa media: <strong class="text-green-600">${resaAnno}%</strong></span>
                                    </div>
                                </div>
                                
                                <!-- Questo mese -->
                                <div class="bg-gray-50 p-3 rounded-lg mb-4">
                                    <h3 class="font-bold text-gray-700 mb-2">📅 Questo mese</h3>
                                    <div class="flex gap-4">
                                        <span class="text-sm"><strong>${questoMese.length}</strong> lavorazioni</span>
                                        <span class="text-sm"><strong>${kgMese.toFixed(0)}</strong> kg freschi</span>
                                    </div>
                                </div>
                                
                                <!-- Per Prodotto -->
                                <div class="mb-4">
                                    <h3 class="font-bold text-gray-700 mb-2">🥕 Per Prodotto</h3>
                                    <div class="space-y-2">
                                        ${Object.entries(perProdotto)
                                            .sort((a, b) => b[1].kgFreschi - a[1].kgFreschi)
                                            .map(([prod, data]) => {
                                                const resa = data.kgFreschi > 0 ? ((data.kgSecchi / data.kgFreschi) * 100).toFixed(1) : 0;
                                                return html`
                                                    <div class="bg-white p-2 rounded border flex justify-between items-center">
                                                        <span class="font-medium">${prod}</span>
                                                        <div class="text-sm text-gray-600">
                                                            <span class="mr-3">${data.count}x</span>
                                                            <span class="mr-3">${data.kgFreschi.toFixed(0)} kg</span>
                                                            <span class="text-green-600">resa ${resa}%</span>
                                                        </div>
                                                    </div>
                                                `;
                                            })
                                        }
                                    </div>
                                </div>
                                
                                <!-- Per Fornitore -->
                                <div>
                                    <h3 class="font-bold text-gray-700 mb-2">🏪 Per Fornitore</h3>
                                    <div class="space-y-2">
                                        ${Object.entries(perFornitore)
                                            .sort((a, b) => b[1].kgFreschi - a[1].kgFreschi)
                                            .map(([forn, data]) => html`
                                                <div class="bg-white p-2 rounded border flex justify-between items-center">
                                                    <span class="font-medium">${forn}</span>
                                                    <div class="text-sm text-gray-600">
                                                        <span class="mr-3">${data.count} lavorazioni</span>
                                                        <span>${data.kgFreschi.toFixed(0)} kg</span>
                                                    </div>
                                                </div>
                                            `)
                                        }
                                    </div>
                                </div>
                            `;
                        })()}
                    </div>
                `}

                <!-- Lavorazione corrente -->
                ${currentLavorazione && html`
                    <div class="bg-white rounded-lg shadow-lg p-4 mb-4 border-2 border-blue-500">
                        <div class="mb-4">
                            <h2 class="text-xl font-bold text-blue-800">
                                ${currentLavorazione.completata ? '📋 Completata' : '🔵 In Corso'}
                            </h2>
                            <p class="text-gray-600">${currentLavorazione.prodotto} - ${currentLavorazione.kgAcquistati} kg</p>
                            <p class="text-sm text-gray-500">
                                ${currentLavorazione.fornitore} | ${new Date(currentLavorazione.dataInizio).toLocaleDateString('it-IT')}
                            </p>
                        </div>

                        ${!currentLavorazione.completata && html`
                            <div class="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <h3 class="font-bold text-amber-800 mb-2">📦 Completa e Crea Lotto</h3>
                                <div class="grid grid-cols-2 gap-3">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Kg Secco *</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value=${kgSecco}
                                            onInput=${(e) => setKgSecco(e.target.value)}
                                            placeholder="Kg prodotto secco"
                                            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
                                        <select
                                            value=${categoriaLotto}
                                            onChange=${(e) => setCategoriaLotto(e.target.value)}
                                            class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        >
                                            <option value="frutta">🍎 Frutta</option>
                                            <option value="verdura">🥕 Verdura</option>
                                            <option value="erbe">🌿 Erbe</option>
                                            <option value="funghi">🍄 Funghi</option>
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onClick=${completaLavorazione}
                                    disabled=${creatingLotto}
                                    class="mt-3 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium"
                                >
                                    ${creatingLotto ? '⏳ Creazione lotto...' : '✅ Completa e Crea Lotto'}
                                </button>
                                <p class="text-xs text-gray-500 mt-2">
                                    Il lotto verrà creato automaticamente nel foglio "Gestione Lotti"
                                </p>
                            </div>
                        `}

                        ${currentLavorazione.completata && html`
                            <div class="mb-4 bg-green-50 rounded-lg p-4 border border-green-200">
                                <h3 class="font-bold text-green-800 mb-2">📊 Riepilogo</h3>
                                <div class="grid grid-cols-3 gap-2">
                                    <div class="bg-white p-2 rounded text-center">
                                        <div class="text-xs text-gray-600">Secco</div>
                                        <div class="text-lg font-bold text-green-600">${currentLavorazione.kgSecco} kg</div>
                                    </div>
                                    <div class="bg-white p-2 rounded text-center">
                                        <div class="text-xs text-gray-600">Manodopera</div>
                                        <div class="text-lg font-bold text-blue-600">${formatOre(currentLavorazione.oreManooperaTotali)}</div>
                                    </div>
                                    <div class="bg-white p-2 rounded text-center">
                                        <div class="text-xs text-gray-600">Macchina</div>
                                        <div class="text-lg font-bold text-purple-600">${formatOre(currentLavorazione.oreMacchinaTotali)}</div>
                                    </div>
                                </div>
                            </div>
                        `}

                        <!-- Attività registrate -->
                        ${currentLavorazione.attivita && currentLavorazione.attivita.length > 0 && html`
                            <div class="mb-4">
                                <h3 class="font-bold text-gray-800 mb-2">Attività Registrate</h3>
                                <div class="space-y-2">
                                    ${currentLavorazione.attivita.map(att => html`
                                        <div class="bg-blue-50 p-3 rounded-lg border border-blue-200 text-sm">
                                            <div class="flex justify-between items-start mb-1">
                                                <span class="font-medium">📅 ${new Date(att.data).toLocaleDateString('it-IT')}</span>
                                                ${att.oraInizioLavoro && att.oraFineLavoro && html`
                                                    <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                                                        ⏱️ ${formatOre(calcolaOreManodopera(att.oraInizioLavoro, att.oraFineLavoro, att.numeroPersone))}
                                                    </span>
                                                `}
                                            </div>
                                            ${att.oraInizioLavoro && html`
                                                <div class="text-gray-700">
                                                    👷 ${att.oraInizioLavoro}-${att.oraFineLavoro} (${att.numeroPersone}p)
                                                </div>
                                            `}
                                            ${(att.oraAccensione40 || att.oraSpegnimento40) && html`
                                                <div class="text-blue-700">
                                                    🔵 40: ${att.oraAccensione40 && `▶️${att.oraAccensione40}`} ${att.oraSpegnimento40 && `⏹️${att.oraSpegnimento40}`}
                                                </div>
                                            `}
                                            ${(att.oraAccensione100 || att.oraSpegnimento100) && html`
                                                <div class="text-green-700">
                                                    🟢 100: ${att.oraAccensione100 && `▶️${att.oraAccensione100}`} ${att.oraSpegnimento100 && `⏹️${att.oraSpegnimento100}`}
                                                </div>
                                            `}
                                            ${att.pulizie && Object.values(att.pulizie).some(v => v) && html`
                                                <div class="mt-1 flex flex-wrap gap-1">
                                                    ${att.pulizie.pianoLavoro && html`<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">Piano lavoro</span>`}
                                                    ${att.pulizie.lavello && html`<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">Lavello</span>`}
                                                    ${att.pulizie.tagliaverdure && html`<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">Tagliaverdure</span>`}
                                                    ${att.pulizie.scopatoPavimento && html`<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">Scopatura pavimento</span>`}
                                                    ${att.pulizie.lavatoPavimento && html`<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">Lavaggio pavimento</span>`}
                                                    ${att.pulizie.disidratatore && html`<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">Disidratatore</span>`}
                                                    ${att.pulizie.ceste && html`<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">Ceste</span>`}
                                                    ${att.pulizie.retine && html`<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">Retine</span>`}
                                                </div>
                                            `}
                                            ${att.note && html`<div class="text-gray-600 italic mt-1 text-xs">💬 ${att.note}</div>`}
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `}

                        <!-- Form attività - solo se non completata -->
                        ${!currentLavorazione.completata && html`
                            <div class="bg-gray-50 rounded-lg p-3">
                                <h3 class="font-bold text-gray-800 mb-3">➕ Nuova Attività</h3>
                                
                                <div class="space-y-3">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Data</label>
                                        <input
                                            type="date"
                                            value=${attivitaGiornaliera.data}
                                            onInput=${(e) => setAttivitaGiornaliera({...attivitaGiornaliera, data: e.target.value})}
                                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>

                                    <div>
                                        <h4 class="font-medium text-gray-700 mb-2 text-sm">👷 Manodopera</h4>
                                        <div class="grid grid-cols-3 gap-2">
                                            <input
                                                type="time"
                                                value=${attivitaGiornaliera.oraInizioLavoro}
                                                onInput=${(e) => setAttivitaGiornaliera({...attivitaGiornaliera, oraInizioLavoro: e.target.value})}
                                                placeholder="Inizio"
                                                class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            />
                                            <input
                                                type="time"
                                                value=${attivitaGiornaliera.oraFineLavoro}
                                                onInput=${(e) => setAttivitaGiornaliera({...attivitaGiornaliera, oraFineLavoro: e.target.value})}
                                                placeholder="Fine"
                                                class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            />
                                            <input
                                                type="number"
                                                min="1"
                                                value=${attivitaGiornaliera.numeroPersone}
                                                onInput=${(e) => setAttivitaGiornaliera({...attivitaGiornaliera, numeroPersone: parseInt(e.target.value)})}
                                                placeholder="N° pers"
                                                class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <h4 class="font-medium text-gray-700 mb-2 text-sm">🔵 Disidratatore 40</h4>
                                        <div class="grid grid-cols-2 gap-2">
                                            <input
                                                type="time"
                                                value=${attivitaGiornaliera.oraAccensione40}
                                                onInput=${(e) => setAttivitaGiornaliera({...attivitaGiornaliera, oraAccensione40: e.target.value})}
                                                placeholder="Accensione"
                                                class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            />
                                            <input
                                                type="time"
                                                value=${attivitaGiornaliera.oraSpegnimento40}
                                                onInput=${(e) => setAttivitaGiornaliera({...attivitaGiornaliera, oraSpegnimento40: e.target.value})}
                                                placeholder="Spegnimento"
                                                class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <h4 class="font-medium text-gray-700 mb-2 text-sm">🟢 Disidratatore 100</h4>
                                        <div class="grid grid-cols-2 gap-2">
                                            <input
                                                type="time"
                                                value=${attivitaGiornaliera.oraAccensione100}
                                                onInput=${(e) => setAttivitaGiornaliera({...attivitaGiornaliera, oraAccensione100: e.target.value})}
                                                placeholder="Accensione"
                                                class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            />
                                            <input
                                                type="time"
                                                value=${attivitaGiornaliera.oraSpegnimento100}
                                                onInput=${(e) => setAttivitaGiornaliera({...attivitaGiornaliera, oraSpegnimento100: e.target.value})}
                                                placeholder="Spegnimento"
                                                class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <h4 class="font-medium text-gray-700 mb-2 text-sm">🧹 Pulizie giornaliere</h4>
                                        <div class="grid grid-cols-2 gap-2">
                                            ${Object.entries({
                                                pianoLavoro: 'Piano lavoro',
                                                lavello: 'Lavello',
                                                tagliaverdure: 'Tagliaverdure',
                                                scopatoPavimento: 'Scopatura pavimento',
                                                lavatoPavimento: 'Lavaggio pavimento',
                                                disidratatore: 'Disidratatore',
                                                ceste: 'Ceste',
                                                retine: 'Retine'
                                            }).map(([key, label]) => html`
                                                <label class="flex items-center space-x-2 cursor-pointer text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked=${attivitaGiornaliera.pulizie[key]}
                                                        onChange=${(e) => setAttivitaGiornaliera({
                                                            ...attivitaGiornaliera,
                                                            pulizie: {...attivitaGiornaliera.pulizie, [key]: e.target.checked}
                                                        })}
                                                        class="w-4 h-4"
                                                    />
                                                    <span>${label}</span>
                                                </label>
                                            `)}
                                        </div>
                                    </div>

                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Note</label>
                                        <textarea
                                            value=${attivitaGiornaliera.note}
                                            onInput=${(e) => setAttivitaGiornaliera({...attivitaGiornaliera, note: e.target.value})}
                                            placeholder="Note..."
                                            rows="2"
                                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick=${aggiungiAttivita}
                                    class="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm"
                                >
                                    ➕ Aggiungi Attività
                                </button>
                            </div>
                        `}
                    </div>
                `}

                <!-- Storico lavorazioni -->
                <div class="bg-white rounded-lg shadow-lg p-4">
                    <h2 class="text-xl font-bold text-gray-800 mb-4">📋 Storico</h2>
                    
                    ${lavorazioni.length === 0 ? html`
                        <p class="text-gray-500 text-center py-8">Nessuna lavorazione</p>
                    ` : html`
                        <div class="space-y-3">
                            ${lavorazioni
                                .sort((a, b) => new Date(b.dataInizio) - new Date(a.dataInizio))
                                .map(lav => html`
                                <div class="${`border rounded-xl overflow-hidden ${lav.completata ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}">
                                    <!-- Header card -->
                                    <div class="p-3 pb-2">
                                        <div class="flex items-center justify-between mb-2">
                                            <h3 class="font-bold text-gray-800 text-base">${lav.prodotto}</h3>
                                            <span class="${`px-2 py-1 rounded-full text-xs font-medium ${lav.completata ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}">
                                                ${lav.completata ? '✅ Completata' : '⏳ In corso'}
                                            </span>
                                        </div>
                                        
                                        <!-- Info grid -->
                                        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-2">
                                            <div class="text-gray-600">
                                                <span class="text-gray-400">📦</span> ${lav.kgAcquistati} kg freschi
                                            </div>
                                            <div class="text-gray-600">
                                                <span class="text-gray-400">🏪</span> ${lav.fornitore}
                                            </div>
                                            <div class="text-gray-600">
                                                <span class="text-gray-400">📅</span> ${new Date(lav.dataInizio).toLocaleDateString('it-IT')}
                                            </div>
                                            <div class="text-gray-600">
                                                <span class="text-gray-400">📝</span> ${lav.attivita.length} ${lav.attivita.length === 1 ? 'giorno' : 'giorni'}
                                            </div>
                                        </div>
                                        
                                        ${lav.completata && html`
                                            <div class="flex flex-wrap gap-2 mt-2 pt-2 border-t border-green-200">
                                                <span class="bg-white px-2 py-1 rounded text-xs font-medium text-orange-600">
                                                    🥕 ${lav.kgSecco} kg secco
                                                </span>
                                                <span class="bg-white px-2 py-1 rounded text-xs font-medium text-blue-600">
                                                    👷 ${formatOre(lav.oreManooperaTotali)}
                                                </span>
                                                <span class="bg-white px-2 py-1 rounded text-xs font-medium text-purple-600">
                                                    ⚙️ ${formatOre(lav.oreMacchinaTotali)}
                                                </span>
                                                <span class="bg-white px-2 py-1 rounded text-xs font-medium text-green-600">
                                                    📊 ${((parseFloat(lav.kgSecco) / parseFloat(lav.kgAcquistati)) * 100).toFixed(1)}% resa
                                                </span>
                                            </div>
                                        `}
                                    </div>
                                    
                                    <!-- Footer con pulsanti -->
                                    <div class="${`flex justify-end gap-2 p-2 ${lav.completata ? 'bg-green-100' : 'bg-yellow-100'}`}">
                                        ${currentLavorazione?.id !== lav.id && html`
                                            <button
                                                onClick=${() => riprendiLavorazione(lav)}
                                                class="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm"
                                            >
                                                ${lav.completata ? '👁️ Vedi' : '📝 Modifica'}
                                            </button>
                                        `}
                                        <button
                                            onClick=${() => eliminaLavorazione(lav.id)}
                                            class="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm"
                                        >
                                            🗑️ Elimina
                                        </button>
                                    </div>
                                </div>
                            `)}
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

render(html`<${App} />`, document.getElementById('root'));

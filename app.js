import { html, render, useState, useEffect } from 'https://esm.sh/htm/preact/standalone';

// ============================================
// CONFIGURAZIONE API
// ============================================
const API_URL = 'https://disidratazione-backend.aziendamalbosca.workers.dev'; // Sostituisci con il tuo URL Cloudflare Worker

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
            // Fallback localStorage
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
            
            // Backup localStorage
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
            
            // Backup localStorage
            const lavorazioni = await this.caricaLavorazioni();
            const nuove = lavorazioni.filter(l => l.id !== id);
            localStorage.setItem('lavorazioni', JSON.stringify(nuove));
            
            return true;
        } catch (error) {
            console.error('Errore eliminazione:', error);
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
            tagliaverdure: false,
            scopatoPavimento: false,
            lavatoPavimento: false,
            disidratatore: false,
            ceste: false,
            retine: false
        },
        note: ''
    });

    const [kgSecco, setKgSecco] = useState('');

    useEffect(() => {
        caricaDati();
        
        // Online/Offline detection
        window.addEventListener('online', () => setOnline(true));
        window.addEventListener('offline', () => setOnline(false));
    }, []);

    const caricaDati = async () => {
        setLoading(true);
        const lav = await API.caricaLavorazioni();
        setLavorazioni(lav);
        setLoading(false);
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
        
        const lav = lavorazioni.find(l => l.id === currentLavorazione.id);
        setCurrentLavorazione(lav);

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

        let oreManooperaTotali = 0;
        let oreMacchinaTotali = 0;

        currentLavorazione.attivita.forEach(att => {
            oreManooperaTotali += calcolaOreManodopera(att.oraInizioLavoro, att.oraFineLavoro, att.numeroPersone);
            oreMacchinaTotali += calcolaOreMacchina(att.oraAccensione40, att.oraSpegnimento40);
            oreMacchinaTotali += calcolaOreMacchina(att.oraAccensione100, att.oraSpegnimento100);
        });

        const lavorazioneCompletata = {
            ...currentLavorazione,
            completata: true,
            kgSecco: kgSecco,
            oreManooperaTotali: oreManooperaTotali,
            oreMacchinaTotali: oreMacchinaTotali
        };

        await API.salvaLavorazione(lavorazioneCompletata);
        await caricaDati();
        
        setCurrentLavorazione(null);
        setKgSecco('');
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
                <div class="bg-white rounded-lg shadow-lg p-4 mb-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <h1 class="text-2xl md:text-3xl font-bold text-green-800 mb-2">
                                🥕 Gestione Disidratazione
                            </h1>
                            <p class="text-sm text-gray-600">Tracciamento lavorazioni</p>
                        </div>
                        <div class="text-right">
                            ${online ? html`
                                <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                                    ✓ Online
                                </span>
                            ` : html`
                                <span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-medium">
                                    ✗ Offline
                                </span>
                            `}
                        </div>
                    </div>
                </div>

                <!-- Pulsante Nuova Lavorazione -->
                <div class="mb-4">
                    <button
                        onClick=${() => setShowForm(!showForm)}
                        class="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium shadow-md transition-colors"
                    >
                        ${showForm ? '❌ Chiudi' : '➕ Nuova Lavorazione'}
                    </button>
                </div>

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
                            <div class="mb-4 flex gap-2">
                                <input
                                    type="number"
                                    value=${kgSecco}
                                    onInput=${(e) => setKgSecco(e.target.value)}
                                    placeholder="Kg secco"
                                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                />
                                <button
                                    onClick=${completaLavorazione}
                                    class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium whitespace-nowrap"
                                >
                                    ✅ Completa
                                </button>
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
                                                    ${att.pulizie.pianoLavoro && html`<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">Piano</span>`}
                                                    ${att.pulizie.tagliaverdure && html`<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">Tagliaverdure</span>`}
                                                    ${att.pulizie.scopatoPavimento && html`<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">Scopato Pavimento</span>`}
                                                    ${att.pulizie.lavatoPavimento && html`<span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs">Lavato Pavimento</span>`}
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
                                        <h4 class="font-medium text-gray-700 mb-2 text-sm">🧹 Pulizie</h4>
                                        <div class="grid grid-cols-2 gap-2">
                                            ${Object.entries({
                                                pianoLavoro: 'Piano',
                                                tagliaverdure: 'Tagliaverdure',
                                                scopatoPavimento: 'Scopato Pavimento',
                                                lavatoPavimento: 'Lavato Pavimento',
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
                                <div class="${`border rounded-lg p-3 ${lav.completata ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}">
                                    <div class="flex justify-between items-start">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2 mb-1">
                                                <h3 class="font-bold text-gray-800">${lav.prodotto}</h3>
                                                <span class="${`px-2 py-0.5 rounded text-xs font-medium ${lav.completata ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}">
                                                    ${lav.completata ? '✅' : '⏳'}
                                                </span>
                                            </div>
                                            <p class="text-sm text-gray-600">
                                                ${lav.kgAcquistati} kg - ${lav.fornitore}
                                                ${lav.completata && lav.kgSecco ? ` → ${lav.kgSecco} kg` : ''}
                                            </p>
                                            <p class="text-xs text-gray-500">
                                                ${new Date(lav.dataInizio).toLocaleDateString('it-IT')} | ${lav.attivita.length} gg
                                            </p>
                                            ${lav.completata && html`
                                                <div class="flex gap-3 mt-1 text-xs">
                                                    <span class="text-blue-600">👷 ${formatOre(lav.oreManooperaTotali)}</span>
                                                    <span class="text-purple-600">⚙️ ${formatOre(lav.oreMacchinaTotali)}</span>
                                                </div>
                                            `}
                                        </div>
                                        <div class="flex gap-2">
                                            ${currentLavorazione?.id !== lav.id && html`
                                                <button
                                                    onClick=${() => riprendiLavorazione(lav)}
                                                    class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs"
                                                >
                                                    ${lav.completata ? '👁️' : '📝'}
                                                </button>
                                            `}
                                            <button
                                                onClick=${() => eliminaLavorazione(lav.id)}
                                                class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs"
                                            >
                                                🗑️
                                            </button>
                                        </div>
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

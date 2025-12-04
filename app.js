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

// Calcola ore disidratatore considerando accensione/spegnimento in giorni diversi
const calcolaOreDisidratatore = (attivita, tipo) => {
    // tipo = '40' o '100'
    const accensioneKey = `oraAccensione${tipo}`;
    const spegnimentoKey = `oraSpegnimento${tipo}`;
    
    // Raccogli tutti gli eventi con date
    const eventi = [];
    attivita.forEach(att => {
        if (att[accensioneKey]) {
            eventi.push({
                tipo: 'accensione',
                timestamp: new Date(`${att.data}T${att[accensioneKey]}`).getTime()
            });
        }
        if (att[spegnimentoKey]) {
            eventi.push({
                tipo: 'spegnimento',
                timestamp: new Date(`${att.data}T${att[spegnimentoKey]}`).getTime()
            });
        }
    });
    
    // Ordina per timestamp
    eventi.sort((a, b) => a.timestamp - b.timestamp);
    
    // Calcola ore totali: ogni accensione deve essere seguita da uno spegnimento
    let oreTotali = 0;
    let ultimaAccensione = null;
    
    for (const evento of eventi) {
        if (evento.tipo === 'accensione') {
            ultimaAccensione = evento.timestamp;
        } else if (evento.tipo === 'spegnimento' && ultimaAccensione !== null) {
            const diffMs = evento.timestamp - ultimaAccensione;
            const diffOre = diffMs / (1000 * 60 * 60);
            oreTotali += diffOre;
            ultimaAccensione = null;
        }
    }
    
    return oreTotali;
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

    async caricaPulizie() {
        try {
            const response = await fetch(`${API_URL}/pulizie`);
            if (!response.ok) throw new Error('Errore caricamento pulizie');
            return await response.json();
        } catch (error) {
            console.error('Errore API:', error);
            return [];
        }
    },

    async salvaPulizia(pulizia) {
        try {
            const response = await fetch(`${API_URL}/pulizie`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pulizia)
            });
            if (!response.ok) throw new Error('Errore salvataggio pulizia');
            return true;
        } catch (error) {
            console.error('Errore salvataggio pulizia:', error);
            return false;
        }
    },

    async eliminaPulizia(id) {
        try {
            const response = await fetch(`${API_URL}/pulizie/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Errore eliminazione pulizia');
            return true;
        } catch (error) {
            console.error('Errore eliminazione pulizia:', error);
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
    const [showReport, setShowReport] = useState(false);
    const [showDashboard, setShowDashboard] = useState(true);
    const [creatingLotto, setCreatingLotto] = useState(false);
    const [showPulizie, setShowPulizie] = useState(false);
    const [pulizie, setPulizie] = useState([]);
    const [puliziaForm, setPuliziaForm] = useState({
        data: new Date().toISOString().split('T')[0],
        locale: 'Laboratorio',
        // Pulizie giornaliere
        pianoLavoro: false,
        lavello: false,
        tagliaverdure: false,
        spazzaturaPavimento: false,
        lavaggioPavimentoDetergente: false,
        disidratatore: false,
        ceste: false,
        retine: false,
        controlloRagnatele: false,
        // Altri campi
        prodottoUtilizzato: '',
        angoliScaffali: 'Puliti',
        esito: 'Conforme',
        noteNonConformita: '',
        note: '',
        operatore: 'Emanuele Visigalli'
    });
    
    // Settimana per report HACCP (default: settimana corrente)
    const getSettimanaCorrente = () => {
        const oggi = new Date();
        const giorno = oggi.getDay();
        const diff = oggi.getDate() - giorno + (giorno === 0 ? -6 : 1);
        const lunedi = new Date(oggi.setDate(diff));
        return lunedi.toISOString().split('T')[0];
    };
    const getFinePeriodo = () => {
        const oggi = new Date();
        return oggi.toISOString().split('T')[0];
    };
    const [dataInizioReport, setDataInizioReport] = useState(getSettimanaCorrente());
    const [dataFineReport, setDataFineReport] = useState(getFinePeriodo());

    // Form nuova lavorazione con lista prodotti
    const [formData, setFormData] = useState({
        dataInizio: new Date().toISOString().split('T')[0],
        prodotti: [{ id: 'PROD_' + Date.now(), prodotto: '', fornitore: '', kgAcquistati: '', kgSecco: '', categoria: 'verdura' }]
    });
    
    // Per il completamento: kg secco e categoria per ogni prodotto
    const [prodottiCompletamento, setProdottiCompletamento] = useState([]);
    
    // Per modifica attività esistente
    const [attivitaInModifica, setAttivitaInModifica] = useState(null);

    const [attivitaGiornaliera, setAttivitaGiornaliera] = useState({
        data: new Date().toISOString().split('T')[0],
        oraInizioLavoro: '',
        oraFineLavoro: '',
        numeroPersone: 1,
        oraAccensione40: '',
        oraSpegnimento40: '',
        oraAccensione100: '',
        oraSpegnimento100: '',
        note: ''
    });

    useEffect(() => {
        caricaDati();
        caricaPulizie();
        
        window.addEventListener('online', () => setOnline(true));
        window.addEventListener('offline', () => setOnline(false));
    }, []);

    const caricaDati = async () => {
        setLoading(true);
        const lav = await API.caricaLavorazioni();
        setLavorazioni(lav);
        setLoading(false);
    };

    const caricaPulizie = async () => {
        const p = await API.caricaPulizie();
        setPulizie(p);
    };

    const salvaPulizia = async () => {
        if (!puliziaForm.data) {
            alert('Inserisci la data');
            return;
        }

        const nuovaPulizia = {
            id: 'PUL_' + Date.now(),
            ...puliziaForm
        };

        const success = await API.salvaPulizia(nuovaPulizia);
        
        if (success) {
            alert('✅ Pulizia registrata!');
            await caricaPulizie();
            setPuliziaForm({
                data: new Date().toISOString().split('T')[0],
                locale: 'Laboratorio',
                pianoLavoro: false,
                lavello: false,
                tagliaverdure: false,
                spazzaturaPavimento: false,
                lavaggioPavimentoDetergente: false,
                disidratatore: false,
                ceste: false,
                retine: false,
                controlloRagnatele: false,
                prodottoUtilizzato: '',
                angoliScaffali: 'Puliti',
                esito: 'Conforme',
                noteNonConformita: '',
                note: '',
                operatore: 'Emanuele Visigalli'
            });
            setShowPulizie(false);
        } else {
            alert('❌ Errore salvataggio');
        }
    };

    const generaReportHACCP = () => {
        try {
            // Verifica che jsPDF sia caricato
            if (!window.jspdf) {
                alert('❌ Errore: libreria PDF non caricata. Ricarica la pagina.');
                return;
            }
            
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape', 'mm', 'a4');
            
            // Calcola date dal periodo selezionato
            const inizioPeriodo = new Date(dataInizioReport);
            const finePeriodo = new Date(dataFineReport);
            
            // Calcola numero giorni
            const diffTime = finePeriodo - inizioPeriodo;
            const numGiorni = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            
            if (numGiorni < 1 || numGiorni > 31) {
                alert('⚠️ Seleziona un periodo valido (max 31 giorni)');
                return;
            }
            
            const formatDateIT = (d) => {
                return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
            };
        
        // Titolo
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('SCHEDA PULIZIA LOCALI', 148.5, 15, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Periodo dal ${formatDateIT(inizioPeriodo)} al ${formatDateIT(finePeriodo)}`, 148.5, 22, { align: 'center' });
        doc.text('Operatore: Emanuele Visigalli', 148.5, 28, { align: 'center' });
        
        // Raccogli dati per ogni giorno del periodo
        const giorniPeriodo = [];
        for (let i = 0; i < numGiorni; i++) {
            const giorno = new Date(inizioPeriodo);
            giorno.setDate(giorno.getDate() + i);
            const giornoStr = giorno.toISOString().split('T')[0];
            
            // Trova pulizia per questo giorno dalla nuova tabella unificata
            const puliziaGiorno = pulizie.find(p => p.data === giornoStr);
            
            giorniPeriodo.push({
                data: formatDateIT(giorno),
                giornoNome: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][giorno.getDay()],
                // Pulizie giornaliere
                pianoLavoro: puliziaGiorno?.pianoLavoro || false,
                lavello: puliziaGiorno?.lavello || false,
                tagliaverdure: puliziaGiorno?.tagliaverdure || false,
                spazzaturaPavimento: puliziaGiorno?.spazzaturaPavimento || false,
                lavaggioPavimentoDetergente: puliziaGiorno?.lavaggioPavimentoDetergente || false,
                disidratatore: puliziaGiorno?.disidratatore || false,
                ceste: puliziaGiorno?.ceste || false,
                retine: puliziaGiorno?.retine || false,
                controlloRagnatele: puliziaGiorno?.controlloRagnatele || false,
                prodotto: puliziaGiorno?.prodottoUtilizzato || '',
                locale: puliziaGiorno?.locale || '',
                angoli: puliziaGiorno?.angoliScaffali || '',
                esito: puliziaGiorno?.esito || '',
                note: puliziaGiorno?.noteNonConformita || ''
            });
        }
        
        // Simboli
        const check = 'X';
        const empty = '';
        
        // Tabella pulizie giornaliere
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('PULIZIE GIORNALIERE', 14, 38);
        
        const headersGiornaliere = [
            ['Data', 'Giorno', 'Piano\nlavoro', 'Lavello', 'Taglia-\nverdure', 'Spazzatura\npavimento', 'Lavaggio\ndetergente', 'Disidra-\ntatore', 'Ceste', 'Retine', 'Ragnatele']
        ];
        
        const bodyGiornaliere = giorniPeriodo.map(g => [
            g.data,
            g.giornoNome,
            g.pianoLavoro ? check : empty,
            g.lavello ? check : empty,
            g.tagliaverdure ? check : empty,
            g.spazzaturaPavimento ? check : empty,
            g.lavaggioPavimentoDetergente ? check : empty,
            g.disidratatore ? check : empty,
            g.ceste ? check : empty,
            g.retine ? check : empty,
            g.controlloRagnatele ? check : empty
        ]);
        
        doc.autoTable({
            startY: 42,
            head: headersGiornaliere,
            body: bodyGiornaliere,
            theme: 'grid',
            headStyles: { 
                fillColor: [22, 163, 74], 
                fontSize: 7,
                halign: 'center',
                valign: 'middle'
            },
            bodyStyles: { 
                fontSize: 10,
                halign: 'center',
                valign: 'middle',
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 20, fontStyle: 'normal', fontSize: 8 },
                1: { cellWidth: 14, fontStyle: 'normal', fontSize: 8 },
                2: { cellWidth: 17 },
                3: { cellWidth: 17 },
                4: { cellWidth: 17 },
                5: { cellWidth: 20 },
                6: { cellWidth: 20 },
                7: { cellWidth: 17 },
                8: { cellWidth: 17 },
                9: { cellWidth: 17 },
                10: { cellWidth: 20 }
            }
        });
        
        // Tabella dettagli (locale, prodotto, esito, note)
        const yAfterFirst = doc.lastAutoTable.finalY + 10;
        
        doc.setFont('helvetica', 'bold');
        doc.text('DETTAGLI PULIZIE', 14, yAfterFirst);
        
        const headersDettagli = [
            ['Data', 'Giorno', 'Locale', 'Prodotto utilizzato', 'Angoli/Scaffali', 'Esito', 'Note']
        ];
        
        const bodyDettagli = giorniPeriodo
            .filter(g => g.locale || g.prodotto || g.esito || g.note)
            .map(g => [
                g.data,
                g.giornoNome,
                g.locale || '-',
                g.prodotto || '-',
                g.angoli || '-',
                g.esito || '-',
                g.note || ''
            ]);
        
        if (bodyDettagli.length > 0) {
            doc.autoTable({
                startY: yAfterFirst + 4,
                head: headersDettagli,
                body: bodyDettagli,
                theme: 'grid',
                headStyles: { 
                    fillColor: [59, 130, 246], 
                    fontSize: 8,
                    halign: 'center',
                    valign: 'middle'
                },
                bodyStyles: { 
                    fontSize: 9,
                    halign: 'center',
                    valign: 'middle'
                }
            });
        }
        
        // Footer con firme
        const yFinal = (bodyDettagli.length > 0 ? doc.lastAutoTable.finalY : yAfterFirst) + 15;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Firma Operatore: _______________________', 30, yFinal);
        doc.text('Firma Responsabile: _______________________', 170, yFinal);
        doc.text('Data verifica: ____/____/________', 100, yFinal + 10);
        
        // Legenda
        doc.setFontSize(9);
        doc.text('X = Operazione effettuata', 14, yFinal + 20);
        
        // Salva PDF
        const nomeFile = `HACCP_Pulizie_${formatDateIT(inizioPeriodo).replace(/\//g, '-')}_${formatDateIT(finePeriodo).replace(/\//g, '-')}.pdf`;
        doc.save(nomeFile);
        
        alert(`✅ Report PDF generato!\n\nFile: ${nomeFile}`);
        
        } catch (error) {
            console.error('Errore generazione PDF:', error);
            alert(`❌ Errore generazione PDF: ${error.message}`);
        }
    };

    const avviaNuovaLavorazione = async () => {
        // Verifica che tutti i prodotti abbiano i campi obbligatori
        const prodottiValidi = formData.prodotti.filter(p => p.prodotto && p.fornitore && p.kgAcquistati);
        
        if (prodottiValidi.length === 0) {
            alert('Inserisci almeno un prodotto con tutti i campi compilati');
            return;
        }

        const nuovaLav = {
            id: 'LAV_' + Date.now(),
            dataInizio: formData.dataInizio,
            prodotti: prodottiValidi.map(p => ({
                ...p,
                id: p.id || 'PROD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
            })),
            attivita: [],
            completata: false,
            oreManooperaTotali: 0,
            oreMacchinaTotali: 0,
            note: ''
        };

        await API.salvaLavorazione(nuovaLav);
        await caricaDati();
        
        setCurrentLavorazione(nuovaLav);
        setFormData({
            dataInizio: new Date().toISOString().split('T')[0],
            prodotti: [{ id: 'PROD_' + Date.now(), prodotto: '', fornitore: '', kgAcquistati: '', kgSecco: '', categoria: 'verdura' }]
        });
        setShowForm(false);
    };
    
    // Funzioni per gestire lista prodotti nel form
    const aggiungiProdottoForm = () => {
        setFormData({
            ...formData,
            prodotti: [...formData.prodotti, { id: 'PROD_' + Date.now(), prodotto: '', fornitore: '', kgAcquistati: '', kgSecco: '', categoria: 'verdura' }]
        });
    };
    
    const rimuoviProdottoForm = (index) => {
        if (formData.prodotti.length <= 1) return;
        const nuoviProdotti = formData.prodotti.filter((_, i) => i !== index);
        setFormData({ ...formData, prodotti: nuoviProdotti });
    };
    
    const aggiornaProdottoForm = (index, campo, valore) => {
        const nuoviProdotti = [...formData.prodotti];
        nuoviProdotti[index] = { ...nuoviProdotti[index], [campo]: valore };
        setFormData({ ...formData, prodotti: nuoviProdotti });
    };

    const aggiungiAttivita = async () => {
        if (!currentLavorazione) return;
        if (!attivitaGiornaliera.data) {
            alert('Inserisci almeno la data');
            return;
        }

        let lavorazioneAggiornata;
        
        if (attivitaInModifica) {
            // Modifica attività esistente
            lavorazioneAggiornata = {
                ...currentLavorazione,
                attivita: currentLavorazione.attivita.map(att => 
                    att.id === attivitaInModifica ? { ...attivitaGiornaliera, id: attivitaInModifica } : att
                )
            };
            setAttivitaInModifica(null);
        } else {
            // Nuova attività
            const nuovaAttivita = {
                id: 'ATT_' + Date.now(),
                ...attivitaGiornaliera
            };
            lavorazioneAggiornata = {
                ...currentLavorazione,
                attivita: [...currentLavorazione.attivita, nuovaAttivita]
            };
        }

        await API.salvaLavorazione(lavorazioneAggiornata);
        await caricaDati();

        // Reset form
        setAttivitaGiornaliera({
            data: new Date(new Date(attivitaGiornaliera.data).getTime() + 86400000).toISOString().split('T')[0],
            oraInizioLavoro: '',
            oraFineLavoro: '',
            numeroPersone: 1,
            oraAccensione40: '',
            oraSpegnimento40: '',
            oraAccensione100: '',
            oraSpegnimento100: '',
            note: ''
        });
        
        setCurrentLavorazione(null);
    };
    
    const iniziaModificaAttivita = (attivita) => {
        setAttivitaInModifica(attivita.id);
        setAttivitaGiornaliera({
            data: attivita.data,
            oraInizioLavoro: attivita.oraInizioLavoro || '',
            oraFineLavoro: attivita.oraFineLavoro || '',
            numeroPersone: attivita.numeroPersone || 1,
            oraAccensione40: attivita.oraAccensione40 || '',
            oraSpegnimento40: attivita.oraSpegnimento40 || '',
            oraAccensione100: attivita.oraAccensione100 || '',
            oraSpegnimento100: attivita.oraSpegnimento100 || '',
            note: attivita.note || ''
        });
    };
    
    const annullaModificaAttivita = () => {
        setAttivitaInModifica(null);
        setAttivitaGiornaliera({
            data: new Date().toISOString().split('T')[0],
            oraInizioLavoro: '',
            oraFineLavoro: '',
            numeroPersone: 1,
            oraAccensione40: '',
            oraSpegnimento40: '',
            oraAccensione100: '',
            oraSpegnimento100: '',
            note: ''
        });
    };
    
    const eliminaAttivita = async (attivitaId) => {
        if (!currentLavorazione) return;
        
        if (!confirm('Sei sicuro di voler eliminare questa attività?')) return;
        
        const lavorazioneAggiornata = {
            ...currentLavorazione,
            attivita: currentLavorazione.attivita.filter(att => att.id !== attivitaId)
        };
        
        await API.salvaLavorazione(lavorazioneAggiornata);
        await caricaDati();
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

        // Verifica che tutti i prodotti abbiano kg secco e categoria
        const tuttiCompilati = prodottiCompletamento.every(p => p.kgSecco && p.categoria);
        if (!tuttiCompilati) {
            alert('Inserisci kg secco e categoria per tutti i prodotti');
            return;
        }

        setCreatingLotto(true);

        let oreManooperaTotali = 0;
        
        currentLavorazione.attivita.forEach(att => {
            oreManooperaTotali += calcolaOreManodopera(att.oraInizioLavoro, att.oraFineLavoro, att.numeroPersone);
        });

        // Calcola ore disidratatore considerando accensione/spegnimento in giorni diversi
        const oreDisidratatore40 = calcolaOreDisidratatore(currentLavorazione.attivita, '40');
        const oreDisidratatore100 = calcolaOreDisidratatore(currentLavorazione.attivita, '100');
        const oreMacchinaTotali = oreDisidratatore40 + oreDisidratatore100;

        // Calcola totale kg freschi per ripartizione proporzionale
        const totaleKgFreschi = prodottiCompletamento.reduce((sum, p) => sum + (parseFloat(p.kgAcquistati) || 0), 0);

        // Aggiorna prodotti con kg secco e categoria
        const prodottiAggiornati = prodottiCompletamento.map(p => ({
            ...p,
            kgSecco: p.kgSecco,
            categoria: p.categoria
        }));

        const lavorazioneCompletata = {
            ...currentLavorazione,
            prodotti: prodottiAggiornati,
            completata: true,
            oreManooperaTotali: oreManooperaTotali,
            oreMacchinaTotali: oreMacchinaTotali
        };

        await API.salvaLavorazione(lavorazioneCompletata);

        // Crea un lotto per ogni prodotto con ripartizione proporzionale
        const lottiCreati = [];
        const lottiErrori = [];
        
        for (const prod of prodottiCompletamento) {
            const kgFreschiProdotto = parseFloat(prod.kgAcquistati) || 0;
            const proporzione = totaleKgFreschi > 0 ? kgFreschiProdotto / totaleKgFreschi : 0;
            
            const datiLotto = {
                prodotto: prod.prodotto,
                fornitore: prod.fornitore,
                dataInizio: currentLavorazione.dataInizio,
                kgFreschi: prod.kgAcquistati,
                kgSecco: prod.kgSecco,
                oreManodopera: oreManooperaTotali * proporzione,
                oreDisidratatore40: oreDisidratatore40 * proporzione,
                oreDisidratatore100: oreDisidratatore100 * proporzione,
                categoria: prod.categoria
            };

            const risultatoLotto = await API.creaLotto(datiLotto);
            
            if (risultatoLotto.success) {
                lottiCreati.push({ prodotto: prod.prodotto, lotNumber: risultatoLotto.lotNumber });
            } else {
                lottiErrori.push({ prodotto: prod.prodotto, error: risultatoLotto.error });
            }
        }
        
        setCreatingLotto(false);

        // Messaggio riepilogativo
        let messaggio = '✅ Lavorazione completata!\n\n';
        
        if (lottiCreati.length > 0) {
            messaggio += '📦 Lotti creati:\n';
            lottiCreati.forEach(l => {
                messaggio += `  • ${l.prodotto}: ${l.lotNumber}\n`;
            });
        }
        
        if (lottiErrori.length > 0) {
            messaggio += '\n⚠️ Errori:\n';
            lottiErrori.forEach(e => {
                messaggio += `  • ${e.prodotto}: ${e.error}\n`;
            });
        }
        
        alert(messaggio);

        await caricaDati();
        
        setCurrentLavorazione(null);
        setProdottiCompletamento([]);
    };

    const riprendiLavorazione = (lav) => {
        setCurrentLavorazione(lav);
        // Inizializza prodottiCompletamento con i prodotti della lavorazione
        setProdottiCompletamento(lav.prodotti.map(p => ({
            ...p,
            kgSecco: p.kgSecco || '',
            categoria: p.categoria || 'verdura'
        })));
        // Nascondi dashboard e altri pannelli
        setShowDashboard(false);
        setShowForm(false);
        setShowReport(false);
        setShowPulizie(false);
    };

    const aggiornaProdottoCompletamento = (index, campo, valore) => {
        const nuovi = [...prodottiCompletamento];
        nuovi[index] = { ...nuovi[index], [campo]: valore };
        setProdottiCompletamento(nuovi);
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
                <div class="grid grid-cols-4 gap-2 mb-4">
                    <button
                        onClick=${() => { setShowDashboard(!showDashboard); setShowForm(false); setShowReport(false); setShowPulizie(false); }}
                        class="${`flex items-center justify-center gap-1 px-2 py-3 rounded-xl font-medium shadow-md transition-all text-sm ${showDashboard ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-500 hover:bg-purple-600'} text-white`}"
                    >
                        📈 Home
                    </button>
                    <button
                        onClick=${() => { setShowForm(!showForm); setShowDashboard(false); setShowReport(false); setShowPulizie(false); }}
                        class="${`flex items-center justify-center gap-1 px-2 py-3 rounded-xl font-medium shadow-md transition-all text-sm ${showForm ? 'bg-gray-500 hover:bg-gray-600' : 'bg-green-600 hover:bg-green-700'} text-white`}"
                    >
                        ${showForm ? '✕' : '➕'} Nuova
                    </button>
                    <button
                        onClick=${() => { setShowPulizie(!showPulizie); setShowDashboard(false); setShowForm(false); setShowReport(false); }}
                        class="${`flex items-center justify-center gap-1 px-2 py-3 rounded-xl font-medium shadow-md transition-all text-sm ${showPulizie ? 'bg-gray-500 hover:bg-gray-600' : 'bg-amber-600 hover:bg-amber-700'} text-white`}"
                    >
                        ${showPulizie ? '✕' : '🧹'} Pulizie
                    </button>
                    <button
                        onClick=${() => { setShowReport(!showReport); setShowDashboard(false); setShowForm(false); setShowPulizie(false); }}
                        class="${`flex items-center justify-center gap-1 px-2 py-3 rounded-xl font-medium shadow-md transition-all text-sm ${showReport ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'} text-white`}"
                    >
                        ${showReport ? '✕' : '📊'} Report
                    </button>
                </div>

                <!-- Dashboard -->
                ${showDashboard && html`
                    <div class="bg-white rounded-xl shadow-lg p-4 mb-4">
                        <h2 class="text-lg font-bold text-purple-800 mb-4">📈 Dashboard</h2>
                        
                        <!-- Statistiche rapide -->
                        <div class="grid grid-cols-2 gap-3 mb-4">
                            <div class="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                                <div class="text-2xl font-bold text-yellow-700">
                                    ${lavorazioni.filter(l => !l.completata).length}
                                </div>
                                <div class="text-xs text-yellow-600">🔄 In corso</div>
                            </div>
                            <div class="bg-green-50 rounded-lg p-3 border border-green-200">
                                <div class="text-2xl font-bold text-green-700">
                                    ${lavorazioni.filter(l => l.completata).length}
                                </div>
                                <div class="text-xs text-green-600">✅ Completate</div>
                            </div>
                            <div class="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                <div class="text-2xl font-bold text-blue-700">
                                    ${(() => {
                                        const totale = lavorazioni.reduce((sum, l) => {
                                            return sum + (l.prodotti || []).reduce((s, p) => s + (parseFloat(p.kgAcquistati) || 0), 0);
                                        }, 0);
                                        return totale.toFixed(1);
                                    })()} kg
                                </div>
                                <div class="text-xs text-blue-600">🥬 Kg freschi totali</div>
                            </div>
                            <div class="bg-orange-50 rounded-lg p-3 border border-orange-200">
                                <div class="text-2xl font-bold text-orange-700">
                                    ${(() => {
                                        const totale = lavorazioni.reduce((sum, l) => {
                                            return sum + (l.prodotti || []).reduce((s, p) => s + (parseFloat(p.kgSecco) || 0), 0);
                                        }, 0);
                                        return totale.toFixed(1);
                                    })()} kg
                                </div>
                                <div class="text-xs text-orange-600">🥕 Kg secchi totali</div>
                            </div>
                        </div>
                        
                        <!-- Pulizie questa settimana -->
                        <div class="bg-amber-50 rounded-lg p-3 border border-amber-200 mb-4">
                            <div class="flex justify-between items-center">
                                <div>
                                    <div class="text-lg font-bold text-amber-700">
                                        ${(() => {
                                            const oggi = new Date();
                                            const inizioSettimana = new Date(oggi);
                                            inizioSettimana.setDate(oggi.getDate() - oggi.getDay() + 1);
                                            inizioSettimana.setHours(0, 0, 0, 0);
                                            return pulizie.filter(p => new Date(p.data) >= inizioSettimana).length;
                                        })()}
                                    </div>
                                    <div class="text-xs text-amber-600">🧹 Pulizie questa settimana</div>
                                </div>
                                <div class="text-3xl">🧹</div>
                            </div>
                        </div>
                        
                        <!-- Lavorazioni in corso -->
                        ${lavorazioni.filter(l => !l.completata).length > 0 && html`
                            <div class="mb-4">
                                <h3 class="font-medium text-gray-700 mb-2 text-sm">🔄 Lavorazioni in corso</h3>
                                <div class="space-y-2">
                                    ${lavorazioni.filter(l => !l.completata).map(lav => html`
                                        <div 
                                            class="bg-yellow-50 p-3 rounded-lg border border-yellow-200 cursor-pointer hover:bg-yellow-100"
                                            onClick=${() => { setCurrentLavorazione(lav); setProdottiCompletamento(lav.prodotti.map(p => ({...p, kgSecco: p.kgSecco || '', categoria: p.categoria || 'verdura'}))); setShowDashboard(false); }}
                                        >
                                            <div class="flex justify-between items-center">
                                                <div>
                                                    <div class="font-medium text-yellow-800">
                                                        ${(lav.prodotti || []).map(p => p.prodotto).join(', ') || 'Prodotti...'}
                                                    </div>
                                                    <div class="text-xs text-yellow-600">
                                                        📅 ${new Date(lav.dataInizio).toLocaleDateString('it-IT')} 
                                                        • ${lav.attivita?.length || 0} attività
                                                    </div>
                                                </div>
                                                <span class="text-yellow-600">▶️</span>
                                            </div>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `}
                        
                        <!-- Ultime pulizie -->
                        ${pulizie.length > 0 && html`
                            <div>
                                <h3 class="font-medium text-gray-700 mb-2 text-sm">🧹 Ultime pulizie</h3>
                                <div class="space-y-2">
                                    ${pulizie.slice(0, 3).map(p => html`
                                        <div class="bg-gray-50 p-2 rounded-lg text-xs flex justify-between items-center">
                                            <div>
                                                <span class="font-medium">${new Date(p.data).toLocaleDateString('it-IT')}</span>
                                                <span class="text-gray-500 ml-2">${p.locale}</span>
                                            </div>
                                            <span class="${p.esito === 'Conforme' ? 'text-green-600' : 'text-red-600'}">${p.esito === 'Conforme' ? '✅' : '❌'}</span>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `}
                    </div>
                `}

                <!-- Form Pulizie -->
                ${showPulizie && html`
                    <div class="bg-white rounded-xl shadow-lg p-4 mb-4 border-2 border-amber-400">
                        <h2 class="text-lg font-bold text-amber-800 mb-4">🧹 Registrazione Pulizie</h2>
                        
                        <div class="space-y-4">
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                                    <input
                                        type="date"
                                        value=${puliziaForm.data}
                                        onInput=${(e) => setPuliziaForm({...puliziaForm, data: e.target.value})}
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Locale *</label>
                                    <select
                                        value=${puliziaForm.locale}
                                        onChange=${(e) => setPuliziaForm({...puliziaForm, locale: e.target.value})}
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="Laboratorio">🏭 Laboratorio</option>
                                        <option value="Magazzino">📦 Magazzino</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Pulizie Giornaliere -->
                            <div>
                                <h4 class="font-medium text-green-700 mb-2 text-sm">🧹 Operazioni effettuate</h4>
                                <div class="grid grid-cols-2 gap-2">
                                    ${Object.entries({
                                        pianoLavoro: 'Piano lavoro',
                                        lavello: 'Lavello',
                                        tagliaverdure: 'Tagliaverdure',
                                        spazzaturaPavimento: 'Spazzatura pavimento',
                                        lavaggioPavimentoDetergente: 'Lavaggio pavimento con detergente',
                                        disidratatore: 'Disidratatore',
                                        ceste: 'Ceste',
                                        retine: 'Retine',
                                        controlloRagnatele: 'Controllo ragnatele'
                                    }).map(([key, label]) => html`
                                        <label class="flex items-center space-x-2 cursor-pointer bg-green-50 p-2 rounded-lg text-sm">
                                            <input
                                                type="checkbox"
                                                checked=${puliziaForm[key]}
                                                onChange=${(e) => setPuliziaForm({...puliziaForm, [key]: e.target.checked})}
                                                class="w-4 h-4"
                                            />
                                            <span>${label}</span>
                                        </label>
                                    `)}
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Prodotto utilizzato</label>
                                <input
                                    type="text"
                                    value=${puliziaForm.prodottoUtilizzato}
                                    onInput=${(e) => setPuliziaForm({...puliziaForm, prodottoUtilizzato: e.target.value})}
                                    placeholder="Es: Detergente XYZ"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                            
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Angoli/Scaffali</label>
                                    <select
                                        value=${puliziaForm.angoliScaffali}
                                        onChange=${(e) => setPuliziaForm({...puliziaForm, angoliScaffali: e.target.value})}
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="Puliti">✅ Puliti</option>
                                        <option value="Non necessario">➖ Non necessario</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Esito</label>
                                    <select
                                        value=${puliziaForm.esito}
                                        onChange=${(e) => setPuliziaForm({...puliziaForm, esito: e.target.value})}
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="Conforme">✅ Conforme</option>
                                        <option value="Non conforme">❌ Non conforme</option>
                                    </select>
                                </div>
                            </div>
                            
                            ${puliziaForm.esito === 'Non conforme' && html`
                                <div>
                                    <label class="block text-sm font-medium text-red-700 mb-1">Note non conformità *</label>
                                    <textarea
                                        value=${puliziaForm.noteNonConformita}
                                        onInput=${(e) => setPuliziaForm({...puliziaForm, noteNonConformita: e.target.value})}
                                        placeholder="Descrivi il problema riscontrato..."
                                        rows="2"
                                        class="w-full px-3 py-2 border border-red-300 rounded-lg text-sm bg-red-50"
                                    />
                                </div>
                            `}
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Note</label>
                                <textarea
                                    value=${puliziaForm.note}
                                    onInput=${(e) => setPuliziaForm({...puliziaForm, note: e.target.value})}
                                    placeholder="Eventuali annotazioni..."
                                    rows="2"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Operatore</label>
                                <input
                                    type="text"
                                    value=${puliziaForm.operatore}
                                    onInput=${(e) => setPuliziaForm({...puliziaForm, operatore: e.target.value})}
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                        </div>
                        
                        <button
                            onClick=${salvaPulizia}
                            class="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 rounded-xl font-medium"
                        >
                            ✅ Registra Pulizia
                        </button>
                        
                        <!-- Storico pulizie -->
                        ${pulizie.length > 0 && html`
                            <div class="mt-4 pt-4 border-t border-amber-200">
                                <h3 class="font-medium text-gray-700 mb-2 text-sm">📋 Ultime registrazioni</h3>
                                <div class="space-y-2 max-h-40 overflow-y-auto">
                                    ${pulizie
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
                        
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
                            <input
                                type="date"
                                value=${formData.dataInizio}
                                onInput=${(e) => setFormData({...formData, dataInizio: e.target.value})}
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            />
                        </div>
                        
                        <h3 class="font-medium text-gray-700 mb-2">📦 Prodotti</h3>
                        
                        <div class="space-y-3">
                            ${formData.prodotti.map((prod, index) => html`
                                <div key=${prod.id} class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                    <div class="flex justify-between items-center mb-2">
                                        <span class="text-sm font-medium text-gray-600">Prodotto ${index + 1}</span>
                                        ${formData.prodotti.length > 1 && html`
                                            <button
                                                onClick=${() => rimuoviProdottoForm(index)}
                                                class="text-red-500 hover:text-red-700 text-sm"
                                            >
                                                🗑️ Rimuovi
                                            </button>
                                        `}
                                    </div>
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <input
                                            type="text"
                                            value=${prod.prodotto}
                                            onInput=${(e) => aggiornaProdottoForm(index, 'prodotto', e.target.value)}
                                            placeholder="Prodotto *"
                                            class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                        <input
                                            type="text"
                                            value=${prod.fornitore}
                                            onInput=${(e) => aggiornaProdottoForm(index, 'fornitore', e.target.value)}
                                            placeholder="Fornitore *"
                                            class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                        <input
                                            type="number"
                                            value=${prod.kgAcquistati}
                                            onInput=${(e) => aggiornaProdottoForm(index, 'kgAcquistati', e.target.value)}
                                            placeholder="Kg freschi *"
                                            step="0.1"
                                            class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                            `)}
                        </div>
                        
                        <button
                            onClick=${aggiungiProdottoForm}
                            class="mt-3 w-full bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium"
                        >
                            ➕ Aggiungi altro prodotto
                        </button>
                        
                        <button
                            onClick=${avviaNuovaLavorazione}
                            class="mt-4 w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium"
                        >
                            ▶️ Avvia Lavorazione
                        </button>
                    </div>
                `}

                <!-- Report e Statistiche -->
                ${showReport && html`
                    <div class="bg-white rounded-lg shadow-lg p-4 mb-4">
                        <h2 class="text-xl font-bold text-gray-800 mb-4">📊 Report e Statistiche</h2>
                        
                        <!-- Report HACCP PDF -->
                        <div class="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6">
                            <h3 class="font-bold text-amber-800 mb-3">🧹 Report Pulizie HACCP</h3>
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Data inizio</label>
                                    <input
                                        type="date"
                                        value=${dataInizioReport}
                                        onInput=${(e) => setDataInizioReport(e.target.value)}
                                        class="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Data fine</label>
                                    <input
                                        type="date"
                                        value=${dataFineReport}
                                        onInput=${(e) => setDataFineReport(e.target.value)}
                                        class="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                            <button
                                onClick=${generaReportHACCP}
                                class="w-full bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                            >
                                📄 Genera PDF
                            </button>
                            <p class="text-xs text-amber-700 mt-2">
                                Il report include le pulizie dal ${new Date(dataInizioReport).toLocaleDateString('it-IT')} al ${new Date(dataFineReport).toLocaleDateString('it-IT')}
                            </p>
                        </div>
                        
                        <!-- Invio Email Automatico -->
                        <div class="bg-blue-50 border border-blue-300 rounded-xl p-4 mb-6">
                            <h3 class="font-bold text-blue-800 mb-3">📧 Report Email Settimanale</h3>
                            <p class="text-sm text-blue-700 mb-3">
                                Ogni <strong>lunedì alle 8:00</strong> riceverai automaticamente il report della settimana precedente a <strong>aziendamalbosca@gmail.com</strong>
                            </p>
                            <button
                                onClick=${async () => {
                                    if (!confirm('Inviare il report della settimana scorsa via email?')) return;
                                    try {
                                        const resp = await fetch(API_URL + '/invia-report', { method: 'POST' });
                                        const data = await resp.json();
                                        if (data.success) {
                                            alert('✅ ' + data.message + '\\n\\nPulizie trovate: ' + data.pulizieTrovate);
                                        } else {
                                            alert('❌ Errore: ' + data.error);
                                        }
                                    } catch (err) {
                                        alert('❌ Errore: ' + err.message);
                                    }
                                }}
                                class="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                            >
                                📧 Invia Report Settimana Scorsa (Test)
                            </button>
                        </div>
                        
                        ${(() => {
                            const completate = lavorazioni.filter(l => l.completata);
                            
                            // Calcola totali sommando i prodotti di ogni lavorazione
                            let totKgFreschi = 0;
                            let totKgSecchi = 0;
                            completate.forEach(l => {
                                (l.prodotti || []).forEach(p => {
                                    totKgFreschi += parseFloat(p.kgAcquistati) || 0;
                                    totKgSecchi += parseFloat(p.kgSecco) || 0;
                                });
                            });
                            
                            const totOreManodopera = completate.reduce((sum, l) => sum + (l.oreManooperaTotali || 0), 0);
                            const totOreMacchina = completate.reduce((sum, l) => sum + (l.oreMacchinaTotali || 0), 0);
                            const resaMedia = totKgFreschi > 0 ? ((totKgSecchi / totKgFreschi) * 100).toFixed(1) : 0;
                            
                            // Statistiche per prodotto
                            const perProdotto = {};
                            completate.forEach(l => {
                                (l.prodotti || []).forEach(p => {
                                    const prod = p.prodotto || 'Sconosciuto';
                                    if (!perProdotto[prod]) {
                                        perProdotto[prod] = { kgFreschi: 0, kgSecchi: 0, count: 0 };
                                    }
                                    perProdotto[prod].kgFreschi += parseFloat(p.kgAcquistati) || 0;
                                    perProdotto[prod].kgSecchi += parseFloat(p.kgSecco) || 0;
                                    perProdotto[prod].count += 1;
                                });
                            });
                            
                            // Statistiche per fornitore
                            const perFornitore = {};
                            completate.forEach(l => {
                                (l.prodotti || []).forEach(p => {
                                    const forn = p.fornitore || 'Sconosciuto';
                                    if (!perFornitore[forn]) {
                                        perFornitore[forn] = { kgFreschi: 0, count: 0 };
                                    }
                                    perFornitore[forn].kgFreschi += parseFloat(p.kgAcquistati) || 0;
                                    perFornitore[forn].count += 1;
                                });
                            });
                            
                            const oggi = new Date();
                            const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
                            const questoMese = completate.filter(l => new Date(l.dataInizio) >= inizioMese);
                            let kgMese = 0;
                            questoMese.forEach(l => {
                                (l.prodotti || []).forEach(p => {
                                    kgMese += parseFloat(p.kgAcquistati) || 0;
                                });
                            });
                            
                            const inizioAnno = new Date(oggi.getFullYear(), 0, 1);
                            const questAnno = completate.filter(l => new Date(l.dataInizio) >= inizioAnno);
                            let kgAnnoFreschi = 0;
                            let kgAnnoSecchi = 0;
                            questAnno.forEach(l => {
                                (l.prodotti || []).forEach(p => {
                                    kgAnnoFreschi += parseFloat(p.kgAcquistati) || 0;
                                    kgAnnoSecchi += parseFloat(p.kgSecco) || 0;
                                });
                            });
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
                            <p class="text-sm text-gray-500 mb-2">
                                📅 ${new Date(currentLavorazione.dataInizio).toLocaleDateString('it-IT')}
                            </p>
                            <!-- Lista prodotti -->
                            <div class="space-y-1">
                                ${(currentLavorazione.prodotti || []).map(prod => html`
                                    <div class="flex justify-between items-center bg-gray-50 px-2 py-1 rounded text-sm">
                                        <span class="font-medium">${prod.prodotto}</span>
                                        <span class="text-gray-600">${prod.kgAcquistati} kg - ${prod.fornitore}</span>
                                    </div>
                                `)}
                            </div>
                        </div>

                        ${!currentLavorazione.completata && html`
                            <div class="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                <h3 class="font-bold text-amber-800 mb-3">📦 Completa e Crea Lotti</h3>
                                
                                <div class="space-y-3">
                                    ${prodottiCompletamento.map((prod, index) => html`
                                        <div class="bg-white p-3 rounded-lg border border-amber-200">
                                            <div class="font-medium text-gray-800 mb-2">
                                                ${prod.prodotto} (${prod.kgAcquistati} kg)
                                            </div>
                                            <div class="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label class="block text-xs text-gray-600 mb-1">Kg Secco *</label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value=${prod.kgSecco}
                                                        onInput=${(e) => aggiornaProdottoCompletamento(index, 'kgSecco', e.target.value)}
                                                        placeholder="Kg secco"
                                                        class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label class="block text-xs text-gray-600 mb-1">Categoria *</label>
                                                    <select
                                                        value=${prod.categoria}
                                                        onChange=${(e) => aggiornaProdottoCompletamento(index, 'categoria', e.target.value)}
                                                        class="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    >
                                                        <option value="frutta">🍎 Frutta</option>
                                                        <option value="verdura">🥕 Verdura</option>
                                                        <option value="erbe">🌿 Erbe</option>
                                                        <option value="funghi">🍄 Funghi</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    `)}
                                </div>
                                
                                <button
                                    onClick=${completaLavorazione}
                                    disabled=${creatingLotto}
                                    class="mt-3 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium"
                                >
                                    ${creatingLotto ? '⏳ Creazione lotti...' : `✅ Completa e Crea ${prodottiCompletamento.length} Lott${prodottiCompletamento.length > 1 ? 'i' : 'o'}`}
                                </button>
                                <p class="text-xs text-gray-500 mt-2">
                                    Ore ripartite proporzionalmente ai kg freschi
                                </p>
                            </div>
                        `}

                        ${currentLavorazione.completata && html`
                            <div class="mb-4 bg-green-50 rounded-lg p-4 border border-green-200">
                                <h3 class="font-bold text-green-800 mb-2">📊 Riepilogo</h3>
                                <div class="space-y-2 mb-3">
                                    ${(currentLavorazione.prodotti || []).map(prod => html`
                                        <div class="flex justify-between items-center bg-white px-2 py-1 rounded text-sm">
                                            <span>${prod.prodotto}</span>
                                            <span class="font-medium text-green-600">${prod.kgSecco} kg secco (${((parseFloat(prod.kgSecco) / parseFloat(prod.kgAcquistati)) * 100).toFixed(1)}%)</span>
                                        </div>
                                    `)}
                                </div>
                                <div class="grid grid-cols-2 gap-2">
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
                                        <div class="bg-blue-50 p-3 rounded-lg border border-blue-200 text-sm ${attivitaInModifica === att.id ? 'ring-2 ring-amber-400' : ''}">
                                            <div class="flex justify-between items-start mb-1">
                                                <span class="font-medium">📅 ${new Date(att.data).toLocaleDateString('it-IT')}</span>
                                                <div class="flex gap-1 items-center">
                                                    ${att.oraInizioLavoro && att.oraFineLavoro && html`
                                                        <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                                                            ⏱️ ${formatOre(calcolaOreManodopera(att.oraInizioLavoro, att.oraFineLavoro, att.numeroPersone))}
                                                        </span>
                                                    `}
                                                    ${!currentLavorazione.completata && html`
                                                        <button
                                                            onClick=${() => iniziaModificaAttivita(att)}
                                                            class="text-amber-600 hover:text-amber-800 px-1"
                                                            title="Modifica"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick=${() => eliminaAttivita(att.id)}
                                                            class="text-red-500 hover:text-red-700 px-1"
                                                            title="Elimina"
                                                        >
                                                            🗑️
                                                        </button>
                                                    `}
                                                </div>
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
                                            ${att.note && html`<div class="text-gray-600 italic mt-1 text-xs">💬 ${att.note}</div>`}
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `}

                        <!-- Form attività - solo se non completata -->
                        ${!currentLavorazione.completata && html`
                            <div class="${`rounded-lg p-3 ${attivitaInModifica ? 'bg-amber-50 border-2 border-amber-400' : 'bg-gray-50'}`}">
                                <div class="flex justify-between items-center mb-3">
                                    <h3 class="font-bold text-gray-800">
                                        ${attivitaInModifica ? '✏️ Modifica Attività' : '➕ Nuova Attività'}
                                    </h3>
                                    ${attivitaInModifica && html`
                                        <button
                                            onClick=${annullaModificaAttivita}
                                            class="text-sm text-gray-500 hover:text-gray-700"
                                        >
                                            ✕ Annulla
                                        </button>
                                    `}
                                </div>
                                
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
                                    class="${`mt-3 w-full text-white px-4 py-2 rounded-lg font-medium text-sm ${attivitaInModifica ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}"
                                >
                                    ${attivitaInModifica ? '💾 Salva Modifiche' : '➕ Aggiungi Attività'}
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
                                .map(lav => {
                                    const prodotti = lav.prodotti || [];
                                    const totaleKgFreschi = prodotti.reduce((sum, p) => sum + (parseFloat(p.kgAcquistati) || 0), 0);
                                    const totaleKgSecchi = prodotti.reduce((sum, p) => sum + (parseFloat(p.kgSecco) || 0), 0);
                                    const nomeProdotti = prodotti.map(p => p.prodotto).join(', ');
                                    const nomeFornitore = [...new Set(prodotti.map(p => p.fornitore))].join(', ');
                                    
                                    return html`
                                    <div class="${`border rounded-xl overflow-hidden ${lav.completata ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}">
                                        <!-- Header card -->
                                        <div class="p-3 pb-2">
                                            <div class="flex items-center justify-between mb-2">
                                                <h3 class="font-bold text-gray-800 text-base">${nomeProdotti || 'Lavorazione'}</h3>
                                                <span class="${`px-2 py-1 rounded-full text-xs font-medium ${lav.completata ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}">
                                                    ${lav.completata ? '✅ Completata' : '⏳ In corso'}
                                                </span>
                                            </div>
                                            
                                            <!-- Info grid -->
                                            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-2">
                                                <div class="text-gray-600">
                                                    <span class="text-gray-400">📦</span> ${totaleKgFreschi} kg freschi
                                                </div>
                                                <div class="text-gray-600">
                                                    <span class="text-gray-400">🏪</span> ${nomeFornitore}
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
                                                        🥕 ${totaleKgSecchi.toFixed(1)} kg secco
                                                    </span>
                                                    <span class="bg-white px-2 py-1 rounded text-xs font-medium text-blue-600">
                                                        👷 ${formatOre(lav.oreManooperaTotali)}
                                                    </span>
                                                    <span class="bg-white px-2 py-1 rounded text-xs font-medium text-purple-600">
                                                        ⚙️ ${formatOre(lav.oreMacchinaTotali)}
                                                    </span>
                                                    <span class="bg-white px-2 py-1 rounded text-xs font-medium text-green-600">
                                                        📊 ${totaleKgFreschi > 0 ? ((totaleKgSecchi / totaleKgFreschi) * 100).toFixed(1) : 0}% resa
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
                                `})}
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

render(html`<${App} />`, document.getElementById('root'));

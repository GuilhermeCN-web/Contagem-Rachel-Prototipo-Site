import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex"];

type Categoria = "Infantil" | "Fundamental";
type Turma = { id: string; nome: string; categoria: Categoria };
type Dados = Record<string, number | "">;
type Dia = { key: string; day: number; dow: number; date: Date };
type Semana = { mondayKey: string; mondayDate: Date; dias: Dia[]; semana: number };


function pad(n: number) { return String(n).padStart(2, "0"); }
function dateKey(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function dateToKey(date: Date) { return dateKey(date.getFullYear(), date.getMonth(), date.getDate()); }
function todayKey() { return dateToKey(new Date()); }
function formatDate(date: Date) { return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`; }

function buildWeeks(year: number, month: number): Semana[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstMonday = new Date(firstDay);
  const firstDow = firstMonday.getDay();

  if (firstDow === 0) firstMonday.setDate(firstMonday.getDate() - 6);
  else firstMonday.setDate(firstMonday.getDate() - (firstDow - 1));

  const lastFriday = new Date(lastDay);
  const lastDow = lastFriday.getDay();
  if (lastDow === 0) lastFriday.setDate(lastFriday.getDate() - 2);
  else if (lastDow === 6) lastFriday.setDate(lastFriday.getDate() - 1);
  else lastFriday.setDate(lastFriday.getDate() + (5 - lastDow));

  const weeks: Semana[] = [];
  let currentMonday = new Date(firstMonday);
  let numeroSemana = 1;

  while (currentMonday.getTime() <= lastFriday.getTime()) {
    const dias: Dia[] = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(currentMonday);
      date.setDate(currentMonday.getDate() + i);
      dias.push({ key: dateToKey(date), day: date.getDate(), dow: date.getDay(), date });
    }
    weeks.push({
      mondayKey: dateToKey(currentMonday),
      mondayDate: new Date(currentMonday),
      dias,
      semana: numeroSemana,
    });
    currentMonday.setDate(currentMonday.getDate() + 7);
    numeroSemana++;
  }
  return weeks;
}

export default function FichaChamada() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [dados, setDados] = useState<Dados>({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [registrandoContagem, setRegistrandoContagem] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [turmaEditandoId, setTurmaEditandoId] = useState<string | null>(null);
  const [nomeTurma, setNomeTurma] = useState("");
  const [categoriaTurma, setCategoriaTurma] = useState<Categoria>("Infantil");

  const monthKey = `${year}-${pad(month + 1)}`;
  const weeks = useMemo(() => buildWeeks(year, month), [year, month]);
  const hoje = todayKey();

  useEffect(() => {
    let cancelled = false;
    function load() {
      setLoaded(false);
      try {
        const savedTurmas = localStorage.getItem("turmas");
        if (savedTurmas && !cancelled) setTurmas(JSON.parse(savedTurmas) as Turma[]);
        else if (!cancelled) setTurmas([]);
      } catch { if (!cancelled) setTurmas([]); }

      try {
        const savedDados = localStorage.getItem("chamada:dados");
        if (savedDados && !cancelled) setDados(JSON.parse(savedDados) as Dados);
        else if (!cancelled) setDados({});
      } catch { if (!cancelled) setDados({}); }

      if (!cancelled) setLoaded(true);
    }
    load();
    return () => { cancelled = true; };
  }, [monthKey]);

  const salvarTurmas = useCallback(async (novaLista: Turma[]) => {
    setTurmas(novaLista);
    try {
      localStorage.setItem("turmas", JSON.stringify(novaLista));
      setStatus("Turmas salvas");
      window.setTimeout(() => setStatus(""), 1200);
    } catch { setStatus("Erro ao salvar turmas"); }
  }, []);

  const salvarDadosLocal = useCallback(async (novoDados: Dados) => {
    setDados(novoDados);
    try { localStorage.setItem("chamada:dados", JSON.stringify(novoDados)); }
    catch { setStatus("Erro ao salvar"); }
  }, []);

  function iniciarContagem() {
    setRegistrandoContagem(true);
    setStatus("Modo de contagem ativado");
    window.setTimeout(() => setStatus(""), 1500);
  }

  async function salvarContagem() {
    // Futuramente, localStorage pode ser substituído por um POST/PUT para o backend.
    await salvarDadosLocal(dados);
    setRegistrandoContagem(false);
    setStatus("Contagem salva");
    window.setTimeout(() => setStatus(""), 1500);
  }

  function handleInput(turmaId: string, diaKey: string, valor: string) {
    if (!registrandoContagem) return;
    const num: number | "" = valor === ""
      ? ""
      : Math.max(0, parseInt(valor.replace(/\D/g, ""), 10) || 0);
    const chave = `${turmaId}|${diaKey}`;
    setDados(anterior => ({ ...anterior, [chave]: num }));
  }

  function totalDia(diaKey: string) {
    return turmas.reduce((acc, turma) => acc + (Number(dados[`${turma.id}|${diaKey}`]) || 0), 0);
  }

  function totalDiaCategoria(diaKey: string, categoria: Categoria) {
    return turmas.reduce((acc, turma) => {
      if (turma.categoria !== categoria) return acc;
      return acc + (Number(dados[`${turma.id}|${diaKey}`]) || 0);
    }, 0);
  }

  function totalSemana(week: Semana) {
    return week.dias.reduce((acc, dia) => acc + totalDia(dia.key), 0);
  }

  function pertenceAoMesAtual(diaKey: string) {
    return diaKey.startsWith(`${year}-${pad(month + 1)}`);
  }

  function totalMes() {
    return weeks.reduce((acc, week) => acc + week.dias.reduce((semanaTotal, dia) => {
      if (!pertenceAoMesAtual(dia.key)) return semanaTotal;
      return semanaTotal + totalDia(dia.key);
    }, 0), 0);
  }

  function totalCategoria(categoria: Categoria) {
    return Object.entries(dados).reduce((total, [chave, valor]) => {
      const [turmaId, diaKey] = chave.split("|");
      const turma = turmas.find(t => t.id === turmaId);
      if (turma && turma.categoria === categoria && pertenceAoMesAtual(diaKey)) {
        return total + (Number(valor) || 0);
      }
      return total;
    }, 0);
  }

  function abrirCriacao() {
    setModoEdicao(false);
    setTurmaEditandoId(null);
    setNomeTurma("");
    setCategoriaTurma("Infantil");
    setModalVisible(true);
  }

  function abrirEdicao(turma: Turma) {
    setModoEdicao(true);
    setTurmaEditandoId(turma.id);
    setNomeTurma(turma.nome);
    setCategoriaTurma(turma.categoria);
    setModalVisible(true);
  }

  async function salvarTurmaModal() {
    const nome = nomeTurma.trim();
    if (!nome) { setStatus("Digite o nome da turma"); return; }

    const nomeExiste = turmas.some(turma =>
      turma.nome.toLowerCase() === nome.toLowerCase() && turma.id !== turmaEditandoId
    );
    if (nomeExiste) { setStatus("Essa turma já existe"); return; }

    if (modoEdicao && turmaEditandoId) {
      const novaLista = turmas.map(turma => turma.id === turmaEditandoId
        ? { ...turma, nome, categoria: categoriaTurma }
        : turma);
      await salvarTurmas(novaLista);
    } else {
      const novaTurma: Turma = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        nome,
        categoria: categoriaTurma,
      };
      await salvarTurmas([...turmas, novaTurma]);
    }

    setModalVisible(false);
    setNomeTurma("");
    setTurmaEditandoId(null);
  }

  async function removeTurma(turmaId: string) {
    await salvarTurmas(turmas.filter(turma => turma.id !== turmaId));
  }

  async function moverParaCima(index: number) {
    if (index <= 0) return;
    const novaLista = [...turmas];
    const anterior = novaLista[index - 1];
    novaLista[index - 1] = novaLista[index];
    novaLista[index] = anterior;
    await salvarTurmas(novaLista);
  }

  async function moverParaBaixo(index: number) {
    if (index >= turmas.length - 1) return;
    const novaLista = [...turmas];
    const proxima = novaLista[index + 1];
    novaLista[index + 1] = novaLista[index];
    novaLista[index] = proxima;
    await salvarTurmas(novaLista);
  }

  function mudarMes(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  }

  return (
    <div className="safeArea">
      <div className="root">
        <div className="content">
          <header className="header">
            <div className="headerInfo">
              <h1 className="title">Ficha de Chamada</h1>
              <p className="subtitle">Registro diário de refeições por turma</p>
            </div>
          </header>

          <div className="toolbar">
            <div className="monthNav">
              <button className="monthButton" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
              <span className="monthLabel">{MESES[month]} {year}</span>
              <button className="monthButton" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
            </div>
            {status ? <span className="status">{status}</span> : null}
          </div>

          <section className="actionBar">
            <div>
              <h2 className="sectionTitle">Turmas</h2>
              <p className="sectionSubtitle">Organize e registre as turmas.</p>
            </div>
            <div className="actionButtons">
              {!registrandoContagem ? (
                <button className="countButton" onClick={iniciarContagem}>Registrar contagem</button>
              ) : (
                <button className="saveButton" onClick={salvarContagem}>✓ Salvar contagem</button>
              )}
              <button className="addButton" onClick={abrirCriacao}>+ Nova turma</button>
            </div>
          </section>

          <div className="turmasScroll">
            <div className="turmasScrollContent">
              {turmas.map((turma, index) => (
                <div key={turma.id} className="turmaCard">
                  <div className="turmaCardTop">
                    <div className="turmaCardInfo">
                      <div className="turmaCardName">{turma.nome}</div>
                      <span className={`categoryBadge ${turma.categoria === "Infantil" ? "categoryInfantil" : "categoryFundamental"}`}>
                        {turma.categoria}
                      </span>
                    </div>
                    <button onClick={() => abrirEdicao(turma)} className="editButton" aria-label={`Editar ${turma.nome}`}>✎</button>
                  </div>
                  <div className="turmaCardBottom">
                    <div className="orderButtons">
                      <button onClick={() => moverParaCima(index)} disabled={index === 0} className={`arrowButton ${index === 0 ? "arrowDisabled" : ""}`} aria-label="Mover para cima">↑</button>
                      <button onClick={() => moverParaBaixo(index)} disabled={index === turmas.length - 1} className={`arrowButton ${index === turmas.length - 1 ? "arrowDisabled" : ""}`} aria-label="Mover para baixo">↓</button>
                    </div>
                    <button onClick={() => removeTurma(turma.id)} className="removeButton" aria-label={`Remover ${turma.nome}`}>×</button>
                  </div>
                </div>
              ))}
              {turmas.length === 0 && (
                <button className="emptyTurmaCard" onClick={abrirCriacao}>
                  <strong className="emptyTurmaTitle">Nenhuma turma cadastrada</strong>
                  <span className="emptyTurmaText">Toque aqui para adicionar a primeira turma.</span>
                </button>
              )}
            </div>
          </div>

          <div className="summaryContainer">
            <div className="summaryCard">
              <span className="summaryIndicator indicatorInfantil" />
              <div><div className="summaryLabel">Infantil</div><div className="summaryValue">{totalCategoria("Infantil")}</div><div className="summaryDescription">Total do Infantil HOJE</div></div>
            </div>
            <div className="summaryCard">
              <span className="summaryIndicator indicatorFundamental" />
              <div><div className="summaryLabel">Fundamental</div><div className="summaryValue">{totalCategoria("Fundamental")}</div><div className="summaryDescription">Total do Fundamental HOJE</div></div>
            </div>
            <div className="summaryCard">
              <span className="summaryIndicator indicatorTotal" />
              <div><div className="summaryLabel">Total geral</div><div className="summaryValue">{totalMes()}</div><div className="summaryDescription">Total de Todas as Turmas HOJE</div></div>
            </div>
          </div>

          {weeks.map(week => (
            <section className="semanaBloco" key={week.mondayKey}>
              <div className="semanaHeader">
                <div>
                  <div className="semanaNumero">Semana {week.semana}</div>
                  <div className="semanaDatas">{formatDate(week.dias[0].date)} a {formatDate(week.dias[4].date)}</div>
                </div>
                <div className="weekTotal"><span className="weekTotalLabel">Total</span><strong className="weekTotalValue">{totalSemana(week)}</strong></div>
              </div>

              <div className="tableScroll">
                <div className="table">
                  <div className="row headerRow">
                    <div className="cell turmaCol headerCell"><span className="headerText">Turma</span></div>
                    {week.dias.map(dia => {
                      const isToday = dia.key === hoje;
                      return <div key={dia.key} className={`cell dayCol headerCell ${isToday ? "todayCell" : ""}`}>
                        <span className={`headerText ${isToday ? "todayText" : ""}`}>{DIAS_SEMANA[dia.dow - 1]}</span>
                        <span className={`headerDate ${isToday ? "todayText" : ""}`}>{pad(dia.day)}/{pad(dia.date.getMonth() + 1)}</span>
                      </div>;
                    })}
                  </div>

                  {turmas.map(turma => (
                    <div className="row" key={turma.id}>
                      <div className="cell turmaCol">
                        <div className="turmaTableInfo"><span className="turmaText">{turma.nome}</span><span className="turmaCategory">{turma.categoria}</span></div>
                      </div>
                      {week.dias.map(dia => {
                        const isToday = dia.key === hoje;
                        const value = dados[`${turma.id}|${dia.key}`];
                        return <div key={dia.key} className={`cell dayCol ${isToday ? "todayCell" : ""}`}>
                          <input
                            value={value === undefined ? "" : String(value)}
                            onChange={e => handleInput(turma.id, dia.key, e.target.value)}
                            placeholder="—"
                            inputMode="numeric"
                            disabled={!loaded || !registrandoContagem}
                            className={`numberInput ${!registrandoContagem ? "numberInputDisabled" : ""}`}
                            aria-label={`${turma.nome} - ${formatDate(dia.date)}`}
                          />
                        </div>;
                      })}
                    </div>
                  ))}

                  <div className="row totalRow">
                    <div className="cell turmaCol"><span className="totalDayText">Total do dia</span></div>
                    {week.dias.map(dia => <div key={dia.key} className={`cell dayCol ${dia.key === hoje ? "todayCell" : ""}`}><span className="totalDayText">{totalDia(dia.key)}</span></div>)}
                  </div>

                  <div className="row categoryTotalRow">
                    <div className="cell turmaCol"><span className="categoryTotalLabel">Total Infantil</span></div>
                    {week.dias.map(dia => <div key={dia.key} className={`cell dayCol ${dia.key === hoje ? "todayCell" : ""}`}><span className="categoryTotalText">{totalDiaCategoria(dia.key, "Infantil")}</span></div>)}
                  </div>

                  <div className="row categoryTotalRow">
                    <div className="cell turmaCol"><span className="categoryTotalLabel">Total Fundamental</span></div>
                    {week.dias.map(dia => <div key={dia.key} className={`cell dayCol ${dia.key === hoje ? "todayCell" : ""}`}><span className="categoryTotalText">{totalDiaCategoria(dia.key, "Fundamental")}</span></div>)}
                  </div>
                </div>
              </div>
            </section>
          ))}

          <footer className="rodapeMes">
            <div><div className="rodapeLabel">Total geral</div><div className="rodapeMonth">{MESES[month]} / {year}</div></div>
            <strong className="rodapeNum">{totalMes()}</strong>
          </footer>

          <p className="aviso">Os dados desta ficha ficam salvos neste dispositivo. O botão "Salvar contagem" poderá ser conectado ao banco de dados posteriormente.</p>
        </div>
      </div>

      {modalVisible && (
        <div className="modalOverlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setModalVisible(false); }}>
          <div className="modalCard" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modalHeader">
              <div><h2 id="modal-title" className="modalTitle">{modoEdicao ? "Editar turma" : "Nova turma"}</h2><p className="modalSubtitle">Preencha os dados da turma.</p></div>
              <button onClick={() => setModalVisible(false)} className="modalClose" aria-label="Fechar">×</button>
            </div>

            <div className="formGroup">
              <label className="formLabel" htmlFor="nome-turma">Nome</label>
              <input id="nome-turma" value={nomeTurma} onChange={e => setNomeTurma(e.target.value)} placeholder="Ex.: 1º Fase A" autoFocus className="formInput" />
            </div>

            <div className="formGroup">
              <span className="formLabel">Categoria</span>
              <div className="categoryOptions">
                <button type="button" onClick={() => setCategoriaTurma("Infantil")} className={`categoryOption ${categoriaTurma === "Infantil" ? "categoryOptionSelected" : ""}`}>
                  <span className={`radio ${categoriaTurma === "Infantil" ? "radioSelected" : ""}`} />
                  <span><strong className="categoryOptionTitle">Infantil</strong><small className="categoryOptionDescription">1º Fase até 2º Fase</small></span>
                </button>
                <button type="button" onClick={() => setCategoriaTurma("Fundamental")} className={`categoryOption ${categoriaTurma === "Fundamental" ? "categoryOptionSelected" : ""}`}>
                  <span className={`radio ${categoriaTurma === "Fundamental" ? "radioSelected" : ""}`} />
                  <span><strong className="categoryOptionTitle">Fundamental</strong><small className="categoryOptionDescription">1º Ano até 5º Ano</small></span>
                </button>
              </div>
            </div>

            <div className="modalActions">
              <button onClick={() => setModalVisible(false)} className="cancelButton">Cancelar</button>
              <button onClick={salvarTurmaModal} className="modalSaveButton">{modoEdicao ? "Salvar alterações" : "Criar turma"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

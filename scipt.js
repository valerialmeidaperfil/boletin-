// Configuração fixa do aluno conforme a instrução
const CONFIG_ALUNO = {
  turma: "8C",
  numeroChamada: 14,
  apiUrl: "https://boletim-api.profbt.com.br"
};

// Variavel de sessão para armazenar o PIN em memória (NUNCA gravado em storage)
let pinSessao = "";

// Dados locais fictícios que funcionam como fallback quando não houver dados salvos na API
const dadosDisciplinas = [
  { disciplina: "Língua Portuguesa", tri1: 82, tri2: "7,8", tri3: 85, faltas: [2, 1, 1] },
  { disciplina: "Matemática", tri1: 52, tri2: "5,8", tri3: null, faltas: [3, 2, 1] },
  { disciplina: "Ciências", tri1: "8,1", tri2: 76, tri3: 8.0, faltas: [1, 2, 0] },
  { disciplina: "História", tri1: 7.0, tri2: 84, tri3: null, faltas: [1, 1, 1] },
  { disciplina: "Geografia", tri1: 68, tri2: 7.3, tri3: "7,9", faltas: [0, 1, 1] },
  { disciplina: "Língua Inglesa", tri1: 86, tri2: "8,1", tri3: 8.7, faltas: [1, 0, 0] },
  { disciplina: "Arte", tri1: 9.0, tri2: 92, tri3: null, faltas: [1, 1, 0] },
  { disciplina: "Educação Física", tri1: 95, tri2: 9.0, tri3: "9,4", faltas: [0, 1, 0] },
  { disciplina: "Educação Digital", tri1: 88, tri2: 9.1, tri3: 93, faltas: [1, 0, 1] },
  { disciplina: "Educação Financeira", tri1: 74, tri2: "7,8", tri3: null, faltas: [1, 1, 1] },
  { disciplina: "Estudo Orientado", tri1: 8.0, tri2: 83, tri3: "8,5", faltas: [0, 1, 0] },
  { disciplina: "Redação e Leitura", tri1: 62, tri2: "6,8", tri3: null, faltas: [2, 1, 1] },
  { disciplina: "Pensamento Lógico", tri1: 48, tri2: 5.6, tri3: "6,0", faltas: [2, 2, 1] },
  { disciplina: "Literatura Arte e Movimento", tri1: "7,7", tri2: 80, tri3: null, faltas: [1, 0, 1] },
  { disciplina: "Práticas Experimentais", tri1: 58, tri2: "6,2", tri3: 6.4, faltas: [1, 1, 1] }
];

// Dados ativos exibidos na tela
let dadosAtuais = [];

// Instâncias dos Gráficos (Chart.js)
let graficoMedias = null;
let graficoEvolucao = null;
let graficoFaltas = null;

// Função para normalizar as notas antigas/fictícias para a escala de 0 a 10
function normalizarNota(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  if (typeof valor === "string") {
    valor = valor.replace(",", ".");
  }

  let numero = parseFloat(valor);

  if (isNaN(numero)) {
    return null;
  }

  if (numero > 10 && numero <= 100) {
    numero = numero / 10;
  }

  if (numero < 0 || numero > 10) {
    return null;
  }

  return numero;
}

// Inicialização dos eventos do formulário de login
document.getElementById("login-form").addEventListener("submit", async function (e) {
  e.preventDefault();
  const inputPin = document.getElementById("pin-input");
  const loginStatus = document.getElementById("login-status");
  const btnEntrar = document.getElementById("btn-entrar");

  const pinDigitado = inputPin.value.trim();
  if (!pinDigitado) return;

  loginStatus.className = "status-msg info";
  loginStatus.textContent = "Conectando...";
  btnEntrar.disabled = true;

  try {
    const resposta = await fetch(`${CONFIG_ALUNO.apiUrl}/api/v1/boletins/abrir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turma: CONFIG_ALUNO.turma,
        numero_chamada: CONFIG_ALUNO.numeroChamada,
        pin: pinDigitado
      })
    });

    if (resposta.status === 401) {
      loginStatus.className = "status-msg erro";
      loginStatus.textContent = "Turma, chamada ou PIN inválidos.";
      btnEntrar.disabled = false;
      return;
    }

    if (resposta.status === 429) {
      loginStatus.className = "status-msg erro";
      loginStatus.textContent = "Muitas tentativas. Aguarde um minuto e tente novamente.";
      btnEntrar.disabled = false;
      return;
    }

    if (!resposta.ok) {
      loginStatus.className = "status-msg erro";
      loginStatus.textContent = "Não foi possível conectar ao servidor. Tente novamente.";
      btnEntrar.disabled = false;
      return;
    }

    const resultado = await resposta.json();

    // Armazena PIN em memória de sessão e limpa o campo
    pinSessao = pinDigitado;
    inputPin.value = "";

    // Oculta área de login e exibe o boletim
    document.getElementById("login-section").style.display = "none";
    document.getElementById("boletim-content").style.display = "block";

    // Define quais dados utilizar (API > Locais)
    if (resultado.dados && Array.isArray(resultado.dados.disciplinas) && resultado.dados.disciplinas.length > 0) {
      dadosAtuais = resultado.dados.disciplinas;
    } else {
      dadosAtuais = JSON.parse(JSON.stringify(dadosDisciplinas));
    }

    renderizarBoletim();
    atualizarGraficos();

  } catch (erro) {
    loginStatus.className = "status-msg erro";
    loginStatus.textContent = "Não foi possível conectar ao servidor. Tente novamente.";
    btnEntrar.disabled = false;
  }
});

// Renderização principal da tabela e cards
function renderizarBoletim() {
  const tabelaCorpo = document.getElementById("tabela-corpo");
  tabelaCorpo.innerHTML = "";

  let somaDasMediasGerais = 0;
  let disciplinasComMedia = 0;
  let totalGeralFaltas = 0;
  let quantBomDesempenho = 0;
  let quantAtencao = 0;

  dadosAtuais.forEach((item) => {
    const n1 = normalizarNota(item.tri1);
    const n2 = normalizarNota(item.tri2);
    const n3 = normalizarNota(item.tri3);

    let faltasLista = Array.isArray(item.faltas) ? item.faltas : [0, 0, 0];
    const faltasDisciplina = faltasLista.reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0);
    totalGeralFaltas += faltasDisciplina;

    const notasValidas = [n1, n2, n3].filter((n) => n !== null);

    let mediaTexto = "—";
    let situacao = "Nota ainda não disponível";
    let classeSituacao = "status-indisponivel";

    if (notasValidas.length > 0) {
      const somaNotas = notasValidas.reduce((a, b) => a + b, 0);
      const mediaCalculada = somaNotas / notasValidas.length;

      mediaTexto = mediaCalculada.toFixed(1).replace(".", ",");
      somaDasMediasGerais += mediaCalculada;
      disciplinasComMedia++;

      if (mediaCalculada >= 6.0) {
        situacao = "Bom desempenho";
        classeSituacao = "status-bom";
        quantBomDesempenho++;
      } else {
        situacao = "Atenção";
        classeSituacao = "status-atencao";
        quantAtencao++;
      }
    }

    const formatarNotaTabela = (nota) =>
      nota !== null ? nota.toFixed(1).replace(".", ",") : "Ainda não lançada";

    const tr = document.createElement("tr");

    const tdNome = document.createElement("td");
    const strongNome = document.createElement("strong");
    strongNome.textContent = item.disciplina || "";
    tdNome.appendChild(strongNome);

    const td1 = document.createElement("td");
    td1.textContent = formatarNotaTabela(n1);

    const td2 = document.createElement("td");
    td2.textContent = formatarNotaTabela(n2);

    const td3 = document.createElement("td");
    td3.textContent = formatarNotaTabela(n3);

    const tdMedia = document.createElement("td");
    const strongMedia = document.createElement("strong");
    strongMedia.textContent = mediaTexto;
    tdMedia.appendChild(strongMedia);

    const tdFaltas = document.createElement("td");
    tdFaltas.textContent = faltasDisciplina;

    const tdSituacao = document.createElement("td");
    tdSituacao.className = classeSituacao;
    tdSituacao.textContent = situacao;

    tr.appendChild(tdNome);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(tdMedia);
    tr.appendChild(tdFaltas);
    tr.appendChild(tdSituacao);

    tabelaCorpo.appendChild(tr);
  });

  const mediaGeralFinal = disciplinasComMedia > 0
    ? (somaDasMediasGerais / disciplinasComMedia).toFixed(1).replace(".", ",")
    : "—";

  document.getElementById("card-media").textContent = mediaGeralFinal;
  document.getElementById("card-faltas").textContent = totalGeralFaltas;
  document.getElementById("card-bom-desempenho").textContent = quantBomDesempenho;
  document.getElementById("card-atencao").textContent = quantAtencao;
}

// Evento para alternar para modo de edição
document.getElementById("btn-alterar-dados").addEventListener("click", function () {
  abrirEditor();
});

function abrirEditor() {
  const viewContainer = document.getElementById("view-table-container");
  const editorContainer = document.getElementById("editor-container");
  const btnAlterar = document.getElementById("btn-alterar-dados");

  viewContainer.style.display = "none";
  btnAlterar.style.display = "none";
  editorContainer.style.display = "block";
  editorContainer.innerHTML = "";

  const table = document.createElement("table");
  table.className = "editor-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Disciplina</th>
      <th>1º Tri (Nota)</th>
      <th>2º Tri (Nota)</th>
      <th>3º Tri (Nota)</th>
      <th>1º Tri (Faltas)</th>
      <th>2º Tri (Faltas)</th>
      <th>3º Tri (Faltas)</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  dadosAtuais.forEach((item, index) => {
    const tr = document.createElement("tr");

    const tdNome = document.createElement("td");
    const strongNome = document.createElement("strong");
    strongNome.textContent = item.disciplina;
    tdNome.appendChild(strongNome);
    tr.appendChild(tdNome);

    const formatarInputNota = (val) => {
      const norm = normalizarNota(val);
      return norm !== null ? String(norm).replace(".", ",") : "";
    };

    let faltas = Array.isArray(item.faltas) ? item.faltas : [0, 0, 0];

    const valN1 = formatarInputNota(item.tri1);
    const valN2 = formatarInputNota(item.tri2);
    const valN3 = formatarInputNota(item.tri3);

    const valF1 = faltas[0] !== undefined ? faltas[0] : 0;
    const valF2 = faltas[1] !== undefined ? faltas[1] : 0;
    const valF3 = faltas[2] !== undefined ? faltas[2] : 0;

    tr.innerHTML += `
      <td><input type="text" class="edit-n1" data-index="${index}" value="${valN1}"></td>
      <td><input type="text" class="edit-n2" data-index="${index}" value="${valN2}"></td>
      <td><input type="text" class="edit-n3" data-index="${index}" value="${valN3}"></td>
      <td><input type="text" class="edit-f1" data-index="${index}" value="${valF1}"></td>
      <td><input type="text" class="edit-f2" data-index="${index}" value="${valF2}"></td>
      <td><input type="text" class="edit-f3" data-index="${index}" value="${valF3}"></td>
    `;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  editorContainer.appendChild(table);

  const actionsDiv = document.createElement("div");
  actionsDiv.className = "editor-actions";
  actionsDiv.innerHTML = `
    <button id="btn-salvar-alteracoes" class="btn">Salvar alterações</button>
    <button id="btn-cancelar-edicao" class="btn btn-secondary">Cancelar</button>
  `;
  editorContainer.appendChild(actionsDiv);

  document.getElementById("btn-salvar-alteracoes").addEventListener("click", salvarEdicao);
  document.getElementById("btn-cancelar-edicao").addEventListener("click", fecharEditor);
}

function fecharEditor() {
  document.getElementById("editor-container").style.display = "none";
  document.getElementById("view-table-container").style.display = "block";
  document.getElementById("btn-alterar-dados").style.display = "inline-block";
}

// Validação rigorosa dos campos de nota inseridos pelo usuário
function validarNotaDigitada(str) {
  if (str === null || str === undefined) return { valida: true, valor: null };
  const limpo = str.trim();
  if (limpo === "") return { valida: true, valor: null };

  const normalizado = limpo.replace(",", ".");
  const num = Number(normalizado);

  if (isNaN(num) || num < 0 || num > 10) {
    return { valida: false, valor: null };
  }

  return { valida: true, valor: num };
}

// Validação rigorosa das faltas
function validarFaltaDigitada(str) {
  if (str === null || str === undefined) return { valida: false, valor: null };
  const limpo = str.trim();
  if (limpo === "") return { valida: false, valor: null };

  const num = Number(limpo);
  if (isNaN(num) || !Number.isInteger(num) || num < 0) {
    return { valida: false, valor: null };
  }

  return { valida: true, valor: num };
}

// Processo de envio das edições para a API
async function salvarEdicao() {
  const salvarStatus = document.getElementById("salvar-status");
  salvarStatus.className = "status-msg info";
  salvarStatus.textContent = "";

  const inputs = document.querySelectorAll("#editor-container input");
  inputs.forEach((i) => i.classList.remove("input-erro"));

  let existemErros = false;
  const novasDisciplinas = [];

  dadosAtuais.forEach((item, index) => {
    const inputN1 = document.querySelector(`.edit-n1[data-index="${index}"]`);
    const inputN2 = document.querySelector(`.edit-n2[data-index="${index}"]`);
    const inputN3 = document.querySelector(`.edit-n3[data-index="${index}"]`);
    const inputF1 = document.querySelector(`.edit-f1[data-index="${index}"]`);
    const inputF2 = document.querySelector(`.edit-f2[data-index="${index}"]`);
    const inputF3 = document.querySelector(`.edit-f3[data-index="${index}"]`);

    const resN1 = validarNotaDigitada(inputN1.value);
    const resN2 = validarNotaDigitada(inputN2.value);
    const resN3 = validarNotaDigitada(inputN3.value);

    const resF1 = validarFaltaDigitada(inputF1.value);
    const resF2 = validarFaltaDigitada(inputF2.value);
    const resF3 = validarFaltaDigitada(inputF3.value);

    if (!resN1.valida) { inputN1.classList.add("input-erro"); existemErros = true; }
    if (!resN2.valida) { inputN2.classList.add("input-erro"); existemErros = true; }
    if (!resN3.valida) { inputN3.classList.add("input-erro"); existemErros = true; }

    if (!resF1.valida) { inputF1.classList.add("input-erro"); existemErros = true; }
    if (!resF2.valida) { inputF2.classList.add("input-erro"); existemErros = true; }
    if (!resF3.valida) { inputF3.classList.add("input-erro"); existemErros = true; }

    novasDisciplinas.push({
      disciplina: item.disciplina,
      tri1: resN1.valor,
      tri2: resN2.valor,
      tri3: resN3.valor,
      faltas: [resF1.valor, resF2.valor, resF3.valor]
    });
  });

  if (existemErros) {
    salvarStatus.className = "status-msg erro";
    salvarStatus.textContent = "Verifique os campos destacados com valores inválidos.";
    return;
  }

  const btnSalvar = document.getElementById("btn-salvar-alteracoes");
  btnSalvar.disabled = true;
  salvarStatus.className = "status-msg info";
  salvarStatus.textContent = "Salvando...";

  try {
    const resposta = await fetch(`${CONFIG_ALUNO.apiUrl}/api/v1/boletins/salvar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turma: CONFIG_ALUNO.turma,
        numero_chamada: CONFIG_ALUNO.numeroChamada,
        pin: pinSessao,
        dados: {
          disciplinas: novasDisciplinas
        }
      })
    });

    if (!resposta.ok) {
      salvarStatus.className = "status-msg erro";
      salvarStatus.textContent = "Erro ao salvar alterações. Tente novamente.";
      btnSalvar.disabled = false;
      return;
    }

    dadosAtuais = novasDisciplinas;
    renderizarBoletim();
    atualizarGraficos();
    fecharEditor();

    salvarStatus.className = "status-msg sucesso";
    salvarStatus.textContent = "Dados salvos com sucesso.";
    setTimeout(() => { salvarStatus.textContent = ""; }, 4000);

  } catch (erro) {
    salvarStatus.className = "status-msg erro";
    salvarStatus.textContent = "Falha de rede ao salvar alterações.";
    btnSalvar.disabled = false;
  }
}

// --- FUNÇÕES EXCLUSIVAS DOS GRÁFICOS (ETAPA 3 - APENAS LEITURA) ---

function atualizarGraficoMedias() {
  const canvas = document.getElementById("graficoMediasDisciplinas");
  if (!canvas) return;

  const labels = [];
  const valores = [];

  dadosAtuais.forEach((item) => {
    labels.push(item.disciplina);
    const n1 = normalizarNota(item.tri1);
    const n2 = normalizarNota(item.tri2);
    const n3 = normalizarNota(item.tri3);

    const notasValidas = [n1, n2, n3].filter((n) => n !== null);
    if (notasValidas.length > 0) {
      const soma = notasValidas.reduce((a, b) => a + b, 0);
      const media = soma / notasValidas.length;
      valores.push(Number(media.toFixed(1)));
    } else {
      valores.push(null);
    }
  });

  if (graficoMedias) {
    graficoMedias.destroy();
  }

  const ctx = canvas.getContext("2d");
  graficoMedias = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Média",
          data: valores,
          backgroundColor: "#ff2a85",
          borderColor: "#ff2a85",
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              const val = context.raw;
              if (val === null || val === undefined) return " Sem nota";
              return ` Média: ${String(val).replace(".", ",")}`;
            }
          }
        }
      },
      scales: {
        x: {
          min: 0,
          max: 10,
          grid: { color: "#262638" },
          ticks: { color: "#a0a0b0" }
        },
        y: {
          grid: { color: "#262638" },
          ticks: { color: "#ffffff", font: { size: 11 } }
        }
      }
    }
  });
}

function atualizarGraficoEvolucao() {
  const canvas = document.getElementById("graficoEvolucaoTrimestres");
  if (!canvas) return;

  const trimestres = [1, 2, 3];
  const mediasTrimestrais = trimestres.map((triIndex) => {
    let soma = 0;
    let qtd = 0;

    dadosAtuais.forEach((item) => {
      const prop = `tri${triIndex}`;
      const notaNorm = normalizarNota(item[prop]);
      if (notaNorm !== null) {
        soma += notaNorm;
        qtd++;
      }
    });

    return qtd > 0 ? Number((soma / qtd).toFixed(1)) : null;
  });

  if (graficoEvolucao) {
    graficoEvolucao.destroy();
  }

  const ctx = canvas.getContext("2d");
  graficoEvolucao = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["1º Tri", "2º Tri", "3º Tri"],
      datasets: [
        {
          label: "Média Geral",
          data: mediasTrimestrais,
          borderColor: "#ff2a85",
          backgroundColor: "rgba(255, 42, 133, 0.2)",
          borderWidth: 3,
          pointBackgroundColor: "#ff2a85",
          pointRadius: 5,
          tension: 0.2,
          spanGaps: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              const val = context.raw;
              if (val === null || val === undefined) return " Sem nota";
              return ` Média: ${String(val).replace(".", ",")}`;
            }
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 10,
          grid: { color: "#262638" },
          ticks: { color: "#a0a0b0" }
        },
        x: {
          grid: { color: "#262638" },
          ticks: { color: "#ffffff" }
        }
      }
    }
  });
}

function atualizarGraficoFaltas() {
  const canvas = document.getElementById("graficoFaltasTrimestres");
  if (!canvas) return;

  let faltasTri1 = 0;
  let faltasTri2 = 0;
  let faltasTri3 = 0;

  dadosAtuais.forEach((item) => {
    let faltas = Array.isArray(item.faltas) ? item.faltas : [0, 0, 0];
    faltasTri1 += Number(faltas[0]) || 0;
    faltasTri2 += Number(faltas[1]) || 0;
    faltasTri3 += Number(faltas[2]) || 0;
  });

  const totalFaltasAcumulado = faltasTri1 + faltasTri2 + faltasTri3;
  const LIMITE_RISCO_INTERNO = 350;

  const badgePerigo = document.getElementById("estadoFaltas");
  const cardFaltasContainer = document.getElementById("cardFaltasTrimestres");

  if (totalFaltasAcumulado >= LIMITE_RISCO_INTERNO) {
    if (badgePerigo) badgePerigo.style.display = "inline-block";
    if (cardFaltasContainer) cardFaltasContainer.classList.add("card-perigo");
  } else {
    if (badgePerigo) badgePerigo.style.display = "none";
    if (cardFaltasContainer) cardFaltasContainer.classList.remove("card-perigo");
  }

  if (graficoFaltas) {
    graficoFaltas.destroy();
  }

  const ctx = canvas.getContext("2d");
  graficoFaltas = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["1º Tri", "2º Tri", "3º Tri"],
      datasets: [
        {
          label: "Faltas",
          data: [faltasTri1, faltasTri2, faltasTri3],
          backgroundColor: totalFaltasAcumulado >= LIMITE_RISCO_INTERNO ? "#ff3b30" : "#ff2a85",
          borderColor: totalFaltasAcumulado >= LIMITE_RISCO_INTERNO ? "#ff3b30" : "#ff2a85",
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              return ` ${context.label}: ${context.raw} faltas`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#262638" },
          ticks: { color: "#a0a0b0", precision: 0 }
        },
        x: {
          grid: { color: "#262638" },
          ticks: { color: "#ffffff" }
        }
      }
    }
  });
}

function atualizarGraficos() {
  atualizarGraficoMedias();
  atualizarGraficoEvolucao();
  atualizarGraficoFaltas();
}
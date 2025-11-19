// =================================================
// 1. CONFIGURACIÓN GLOBAL
// =================================================
const AWS_IP = "34.234.8.189"; // <--- ¡PON TU IP ELÁSTICA AQUÍ!
const AWS_PORT = "8000";

let socket;
let isRecording = false;
let recordedSteps = [];
let lastTime = 0;
let lastCommand = "STOP";

// Referencias al HTML
const statusDiv = document.getElementById('connection-status');
const consoleDiv = document.getElementById('console-log');
const lastCmdDiv = document.getElementById('last-cmd');
const sensorDiv = document.getElementById('sensor-dist');

// =================================================
// 2. LÓGICA DE CONEXIÓN (WebSockets)
// =================================================
function conectarWS() {
    socket = new WebSocket(`ws://${AWS_IP}:${AWS_PORT}/ws/web`);

    socket.onopen = function(e) {
        statusDiv.innerHTML = "🟢 CONECTADO A AWS";
        statusDiv.className = "text-center mb-3 text-success";
        log("Sistema Online. Conexión establecida.");
    };

    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        // Actualizar dashboard
        if(data.status === "ok" || data.status === "ejecutando_paso") {
            if(data.ultimo_comando) lastCmdDiv.innerText = data.ultimo_comando;
            if(data.comando) lastCmdDiv.innerText = data.comando; // Para demos
        }
        
        // Datos del sensor
        if(data.tipo === "sensor") {
            sensorDiv.innerText = data.valor + " cm";
        }

        // Mensajes de demos
        if(data.status === "demo_guardada") alert(data.mensaje);
        if(data.status === "demo_finalizada") alert("Secuencia finalizada.");
    };

    socket.onclose = function(event) {
        statusDiv.innerHTML = "🔴 DESCONECTADO - Reintentando...";
        statusDiv.className = "text-center mb-3 text-danger";
        setTimeout(conectarWS, 3000);
    };
}

// Iniciar al cargar la página
window.onload = conectarWS;

// =================================================
// 3. LÓGICA DE CONTROL (Joystick)
// =================================================

// Esta es la función principal que envía datos
let enviarComando = function(comando) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        // 1. Enviar al servidor
        const payload = { accion: "mover", comando: comando };
        socket.send(JSON.stringify(payload));
        
        // 2. Lógica de grabación (si está activa)
        if (isRecording) {
            registrarPasoEnGrabadora(comando);
        }
    } else {
        console.error("No hay conexión WebSocket");
    }
};

// =================================================
// 4. LÓGICA DE MONITOREO
// =================================================
function cambiarModo() {
    const isAuto = document.getElementById('modoSwitch').checked;
    const modoTexto = document.getElementById('modo-texto');
    
    if(isAuto) {
        modoTexto.innerText = "Estado: AUTOMÁTICO";
        modoTexto.className = "mt-2 text-warning";
        if (socket) socket.send(JSON.stringify({ accion: "mover", comando: "AUTO" }));
    } else {
        modoTexto.innerText = "Estado: MANUAL";
        modoTexto.className = "mt-2 text-info";
        if (socket) socket.send(JSON.stringify({ accion: "mover", comando: "MANUAL" }));
    }
}

function log(texto) {
    const div = document.createElement('div');
    const hora = new Date().toLocaleTimeString();
    div.innerText = `[${hora}] ${texto}`;
    consoleDiv.prepend(div);
}

// =================================================
// 5. LÓGICA DE DEMOS (Grabadora)
// =================================================

function iniciarGrabacion() {
    isRecording = true;
    recordedSteps = [];
    lastTime = Date.now();
    lastCommand = "STOP";
    
    // Cambios visuales
    document.getElementById('btn-rec').style.display = 'none';
    document.getElementById('save-controls').style.display = 'block';
    document.getElementById('rec-status').innerText = "Estado: GRABANDO [0 pasos]";
    
    // Cambiar pestaña
    new bootstrap.Tab(document.querySelector('#tab-control')).show();
    alert("Grabación Iniciada. ¡Mueve el robot!");
}

function registrarPasoEnGrabadora(comandoActual) {
    const now = Date.now();
    const duracion = now - lastTime;
    
    if (duracion > 50) { 
        recordedSteps.push({ cmd: lastCommand, time: duracion });
        document.getElementById('rec-status').innerText = `Estado: GRABANDO [${recordedSteps.length} pasos]`;
    }
    lastTime = now;
    lastCommand = comandoActual;
}

function detenerGrabacion() {
    isRecording = false;
    
    // Guardar último paso pendiente
    const now = Date.now();
    recordedSteps.push({ cmd: lastCommand, time: now - lastTime });
    recordedSteps.push({ cmd: "STOP", time: 500 }); // Finalizar siempre en STOP

    // Abrir Modal
    new bootstrap.Modal(document.getElementById('nameModal')).show();
}

function confirmarGuardado() {
    const nombre = document.getElementById('demoNameInput').value;
    if(!nombre) return alert("Escribe un nombre");

    // Enviar a Python para guardar en BD
    socket.send(JSON.stringify({
        accion: "guardar_demo",
        nombre: nombre,
        pasos: recordedSteps
    }));
    
    // Restaurar interfaz
    document.getElementById('btn-rec').style.display = 'block';
    document.getElementById('save-controls').style.display = 'none';
    
    // Cerrar modal y limpiar (truco visual)
    document.querySelector('.modal.show').classList.remove('show');
    document.body.classList.remove('modal-open');
    const backdrop = document.querySelector('.modal-backdrop');
    if(backdrop) backdrop.remove();

    // Agregar botón a la lista
    const lista = document.getElementById('demos-list');
    lista.innerHTML += `<button class="btn btn-outline-light p-3 mt-2 demo-btn" onclick="ejecutarDemo('${nombre}')">▶ <strong>${nombre}</strong></button>`;
}

function ejecutarDemo(nombre) {
    socket.send(JSON.stringify({ accion: "ejecutar_demo", nombre: nombre }));
    alert("Iniciando secuencia: " + nombre);
}
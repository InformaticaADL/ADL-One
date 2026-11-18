// Página del celular para firmar una ficha de equipo (entrega, recepción, técnica).
// El token viene en la URL: /firma/<token>. Lista las firmas que faltan, se firma una por
// una con el dedo y cada una vuelve a la ficha en el computador. Sin dependencias.
(function () {
    var token = location.pathname.split('/').filter(Boolean).pop();
    var api = '/firma/api/' + encodeURIComponent(token);
    var $ = function (id) { return document.getElementById(id); };
    var mostrar = function (id) {
        ['cargando', 'invalido', 'lista-vista', 'firmar-vista'].forEach(function (x) { $(x).classList.toggle('oculto', x !== id); });
    };
    var slotActual = null;

    function pintarLista(info) {
        $('titulo').textContent = info.titulo || 'Firma de ficha';
        $('subtitulo').textContent = info.subtitulo || '';
        var cont = $('lista');
        cont.innerHTML = '';
        var pendientes = 0;
        info.slots.forEach(function (s) {
            if (!s.firmada) pendientes += 1;
            var b = document.createElement('button');
            b.className = 'item';
            var datos = document.createElement('div'); datos.className = 'datos';
            var t = document.createElement('div'); t.className = 'titulo'; t.textContent = s.titulo;
            datos.appendChild(t);
            if (s.nombre) { var n = document.createElement('div'); n.className = 'nombre'; n.textContent = s.nombre; datos.appendChild(n); }
            var estado = document.createElement('span');
            estado.className = s.firmada ? 'hecho' : 'ir';
            estado.textContent = s.firmada ? '✓ Firmada' : 'Firmar ›';
            b.appendChild(datos); b.appendChild(estado);
            b.addEventListener('click', function () { abrirFirma(s); });
            cont.appendChild(b);
        });
        $('completo').classList.toggle('oculto', pendientes > 0);
        $('nota-lista').textContent = pendientes > 0
            ? 'Toque la firma que le corresponde. Las que ya están firmadas no hace falta repetirlas.'
            : 'Si se equivocó, toque una firma para hacerla de nuevo.';
        mostrar('lista-vista');
    }

    function cargar() {
        return fetch(api).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (res) {
            if (!res.ok) { $('invalido-texto').textContent = (res.j && res.j.message) || $('invalido-texto').textContent; mostrar('invalido'); return null; }
            pintarLista(res.j.data);
            return res.j.data;
        }).catch(function () { mostrar('invalido'); return null; });
    }

    function abrirFirma(slot) {
        slotActual = slot;
        $('f-titulo').textContent = slot.titulo;
        $('f-nombre').textContent = slot.nombre ? ' · ' + slot.nombre : '';
        $('error').classList.add('oculto');
        mostrar('firmar-vista');
        prepararLienzo();
    }

    // ── Lienzo de firma (igual que el de verificación de temperatura) ──────────
    var canvas = $('canvas');
    var ctx = canvas.getContext('2d');
    var dibujando = false, ultimo = null, vacio = true, lim = null, trazos = [];
    var TINTA = '#1a3a9c', GROSOR = 2.6;

    function prepararLienzo() {
        var dpr = window.devicePixelRatio || 1;
        var rect = canvas.getBoundingClientRect();
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = TINTA; ctx.fillStyle = TINTA; ctx.lineWidth = GROSOR;
        limpiar();
    }
    function punto(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function marcar(p) {
        lim = lim ? { x0: Math.min(lim.x0, p.x), y0: Math.min(lim.y0, p.y), x1: Math.max(lim.x1, p.x), y1: Math.max(lim.y1, p.y) } : { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    }
    function actualizarBotones() {
        $('limpiar').disabled = vacio;
        $('grabar').disabled = vacio;
        $('ayuda').classList.toggle('oculto', !vacio);
    }
    function limpiar() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        vacio = true; lim = null; trazos = []; actualizarBotones();
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault(); canvas.setPointerCapture(e.pointerId);
        dibujando = true; ultimo = punto(e); marcar(ultimo); trazos.push([ultimo]);
        ctx.beginPath(); ctx.arc(ultimo.x, ultimo.y, 1.3, 0, Math.PI * 2); ctx.fill();
    });
    canvas.addEventListener('pointermove', function (e) {
        if (!dibujando) return;
        e.preventDefault();
        var p = punto(e);
        ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        ultimo = p; marcar(p);
        if (trazos.length) trazos[trazos.length - 1].push(p);
        if (vacio) { vacio = false; actualizarBotones(); }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { canvas.addEventListener(ev, function () { dibujando = false; }); });
    window.addEventListener('resize', function () { if (!$('firmar-vista').classList.contains('oculto')) prepararLienzo(); });

    $('limpiar').addEventListener('click', limpiar);
    $('volver').addEventListener('click', function () { cargar(); });

    // La firma se redibuja desde sus trazos a alta resolución, recortada al área firmada.
    function imagenFirma() {
        var m = 10;
        var ancho = lim.x1 - lim.x0 + m * 2, alto = lim.y1 - lim.y0 + m * 2;
        var k = Math.max(1, Math.min(4, 1600 / ancho));
        var out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(ancho * k)); out.height = Math.max(1, Math.round(alto * k));
        var c = out.getContext('2d');
        c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = TINTA; c.fillStyle = TINTA; c.lineWidth = GROSOR * k;
        var X = function (p) { return (p.x - lim.x0 + m) * k; };
        var Y = function (p) { return (p.y - lim.y0 + m) * k; };
        trazos.forEach(function (t) {
            if (t.length === 1) { c.beginPath(); c.arc(X(t[0]), Y(t[0]), (GROSOR * k) / 2, 0, Math.PI * 2); c.fill(); return; }
            c.beginPath(); c.moveTo(X(t[0]), Y(t[0]));
            for (var i = 1; i < t.length - 1; i += 1) {
                c.quadraticCurveTo(X(t[i]), Y(t[i]), (X(t[i]) + X(t[i + 1])) / 2, (Y(t[i]) + Y(t[i + 1])) / 2);
            }
            c.lineTo(X(t[t.length - 1]), Y(t[t.length - 1])); c.stroke();
        });
        return out.toDataURL('image/png');
    }

    $('grabar').addEventListener('click', function () {
        if (vacio || !slotActual) return;
        var btn = $('grabar');
        btn.disabled = true; btn.textContent = 'Enviando…';
        $('error').classList.add('oculto');
        fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot: slotActual.id, firma: imagenFirma() }) })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                if (!res.ok) throw new Error((res.j && res.j.message) || 'No se pudo enviar la firma');
                pintarLista(res.j.data);
            })
            .catch(function (err) {
                $('error').textContent = err.message || 'No se pudo enviar la firma. Revise la conexión e intente de nuevo.';
                $('error').classList.remove('oculto');
            })
            .then(function () { btn.textContent = 'Grabar firma'; actualizarBotones(); });
    });

    cargar();
})();

// Página del celular para firmar una verificación de temperatura (OI-FoGe-39).
// El token viene en la URL: /firma/<token>. Sin dependencias, para que cargue
// rápido en cualquier celular.
(function () {
    var token = location.pathname.split('/').filter(Boolean).pop();
    var api = '/firma/api/' + encodeURIComponent(token);
    var $ = function (id) { return document.getElementById(id); };
    var mostrar = function (id) {
        ['cargando', 'invalido', 'listo', 'formulario'].forEach(function (x) { $(x).classList.toggle('oculto', x !== id); });
    };

    function mostrarListo() {
        mostrar('listo');
        $('pendientes-bloque').classList.add('oculto');
        $('sin-pendientes').classList.add('oculto');
        fetch(api + '/pendientes').then(function (r) { return r.json(); }).then(function (res) {
            var lista = (res && res.data) || [];
            var cont = $('pendientes');
            cont.innerHTML = '';
            if (!lista.length) { $('sin-pendientes').classList.remove('oculto'); return; }
            lista.forEach(function (f) {
                var b = document.createElement('button');
                b.className = 'item';
                b.disabled = !!f.firmada_celular;
                var datos = document.createElement('div'); datos.className = 'datos';
                var cod = document.createElement('div'); cod.className = 'codigo'; cod.textContent = f.codigo_equipo;
                var det = document.createElement('div'); det.className = 'detalle';
                det.textContent = (f.nombre_equipo || '') + ' · ' + fmtFecha(f.fecha_verificacion) + ' · ' + (f.cumple === 'S' ? 'Cumple' : 'No cumple');
                datos.appendChild(cod); datos.appendChild(det);
                var estado = document.createElement('span');
                estado.className = f.firmada_celular ? 'hecho' : 'ir';
                estado.textContent = f.firmada_celular ? '✓ Firmado' : 'Firmar ›';
                b.appendChild(datos); b.appendChild(estado);
                if (!f.firmada_celular) b.addEventListener('click', function () { abrirFicha(f.id_verificacion, b); });
                cont.appendChild(b);
            });
            $('pendientes-bloque').classList.remove('oculto');
        }).catch(function () { $('sin-pendientes').classList.remove('oculto'); });
    }

    function abrirFicha(id, boton) {
        boton.disabled = true;
        fetch(api + '/abrir/' + id, { method: 'POST' })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                if (!res.ok || !res.j.data || !res.j.data.token) throw new Error((res.j && res.j.message) || 'No se pudo abrir la ficha');
                location.href = '/firma/' + res.j.data.token;
            })
            .catch(function (err) { boton.disabled = false; alert(err.message); });
    }

    var fmtFecha = function (ymd) { var p = String(ymd || '').split('-'); return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : ymd; };
    var fmt1 = function (n) { return n === null || n === undefined ? '—' : (Math.round(n * 10) / 10 + 0).toFixed(1).replace('.', ','); };

    fetch(api).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (res) {
        if (!res.ok) { $('invalido-texto').textContent = (res.j && res.j.message) || $('invalido-texto').textContent; mostrar('invalido'); return; }
        var d = res.j.data;
        $('i-equipo').textContent = d.nombre_equipo || '';
        $('i-codigo').textContent = d.codigo_equipo || '';
        $('i-fecha').textContent = fmtFecha(d.fecha_verificacion);
        $('i-muestreador').textContent = d.muestreador || '';
        var r = $('i-resultado');
        r.textContent = d.cumple ? 'Cumple' : 'No cumple';
        r.className = 'resultado ' + (d.cumple ? 'si' : 'no');
        $('i-errores').innerHTML = '';
        (d.errores || []).forEach(function (e) {
            var div = document.createElement('div');
            var small = document.createElement('small'); small.textContent = 'Error ' + e.rango + ',0 °C';
            var strong = document.createElement('strong'); strong.textContent = fmt1(e.error);
            div.appendChild(small); div.appendChild(strong); $('i-errores').appendChild(div);
        });
        if (d.observacion) { $('i-obs').textContent = d.observacion; $('i-obs-fila').classList.remove('oculto'); }
        if (d.ya_firmado) { mostrarListo(); return; }
        mostrar('formulario');
        prepararLienzo();
    }).catch(function () { mostrar('invalido'); });

    // ── Lienzo de firma ───────────────────────────────────────────────────────
    var canvas = $('canvas');
    var ctx = canvas.getContext('2d');
    var dibujando = false, ultimo = null, vacio = true, lim = null;

    function prepararLienzo() {
        var dpr = window.devicePixelRatio || 1;
        var rect = canvas.getBoundingClientRect();
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0f172a'; ctx.fillStyle = '#0f172a'; ctx.lineWidth = 2.6;
        limpiar();
    }

    function punto(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function marcar(p) {
        lim = lim ? { x0: Math.min(lim.x0, p.x), y0: Math.min(lim.y0, p.y), x1: Math.max(lim.x1, p.x), y1: Math.max(lim.y1, p.y) } : { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    }
    function actualizarBotones() {
        $('limpiar').disabled = vacio;
        $('grabar').disabled = vacio || !$('acepto').checked;
        $('ayuda').classList.toggle('oculto', !vacio);
    }
    function limpiar() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        vacio = true; lim = null; actualizarBotones();
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault(); canvas.setPointerCapture(e.pointerId);
        dibujando = true; ultimo = punto(e); marcar(ultimo);
        ctx.beginPath(); ctx.arc(ultimo.x, ultimo.y, 1.3, 0, Math.PI * 2); ctx.fill();
    });
    canvas.addEventListener('pointermove', function (e) {
        if (!dibujando) return;
        e.preventDefault();
        var p = punto(e);
        ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        ultimo = p; marcar(p);
        if (vacio) { vacio = false; actualizarBotones(); }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { canvas.addEventListener(ev, function () { dibujando = false; }); });
    window.addEventListener('resize', function () { if (!$('formulario').classList.contains('oculto')) prepararLienzo(); });

    $('limpiar').addEventListener('click', limpiar);
    $('acepto').addEventListener('change', actualizarBotones);

    // Recorta al área firmada y limita el ancho, para que la imagen viaje liviana.
    function imagenFirma() {
        var dpr = window.devicePixelRatio || 1, m = 10;
        var sx = Math.max(0, (lim.x0 - m) * dpr), sy = Math.max(0, (lim.y0 - m) * dpr);
        var sw = Math.min(canvas.width - sx, (lim.x1 - lim.x0 + m * 2) * dpr), sh = Math.min(canvas.height - sy, (lim.y1 - lim.y0 + m * 2) * dpr);
        var esc = Math.min(1, 600 / sw);
        var out = document.createElement('canvas');
        out.width = Math.max(1, Math.round(sw * esc)); out.height = Math.max(1, Math.round(sh * esc));
        out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
        return out.toDataURL('image/png');
    }

    $('grabar').addEventListener('click', function () {
        if (vacio || !$('acepto').checked) return;
        var btn = $('grabar');
        btn.disabled = true; btn.textContent = 'Grabando…';
        $('error').classList.add('oculto');
        fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firma: imagenFirma() }) })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                if (!res.ok) throw new Error((res.j && res.j.message) || 'No se pudo grabar la firma');
                mostrarListo();
            })
            .catch(function (err) {
                $('error').textContent = err.message || 'No se pudo grabar la firma. Revise la conexión e intente de nuevo.';
                $('error').classList.remove('oculto');
            })
            .then(function () { btn.textContent = 'Grabar firma'; actualizarBotones(); });
    });

})();

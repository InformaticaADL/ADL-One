let t = ''; process.stdin.on('data', (d) => t += d).on('end', () => {
  const bloques = t.split(/\n(?=\{)/).filter((b) => b.trim().startsWith('{')); console.log(t.split('\n')[0]);
  for (const b of bloques) {
    try {
      const g = JSON.parse(b);
      if (g.errores.length) console.log('\n#' + g.grupo, 'ERROR:', g.errores.join(' | '));
      if (g.valorizados) console.log('\n[grupo ' + g.grupo + '] reglas:', JSON.stringify(g.valorizados.reglas));
      for (const f of g.facturas) {
        const p = f.prefactura || {}; const v = f.valorizacion || {};
        const ok = v.iguales === v.de && p.lineas_iguales === p.de;
        console.log((ok ? 'OK  ' : 'DIF ') + '#' + f.id, '| folio', f.folio, '| prog', f.programa, '| casos', f.casos, '| por', f.por, '| valoriz', v.iguales + '/' + v.de, '| prefactura lineas', p.lineas_iguales + '/' + p.de, '| UF ADLSOFT', f.uf_adlsoft, 'vs ADL ONE (mismas lineas)', p.uf_misma_lineas_adlone, p.error ? '| ERROR ' + p.error : '');
        if (v.diferentes && v.diferentes.length) console.log('     difs:', JSON.stringify(v.diferentes));
        if (p.extras_no_estaban_en_la_original && p.extras_no_estaban_en_la_original.length) console.log('     lineas extra (no estaban en la original):', JSON.stringify(p.extras_no_estaban_en_la_original));
      }
    } catch (e) { console.log('(bloque no legible)', b.slice(0, 160)); }
  }
});

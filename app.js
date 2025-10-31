(function(){
  const { useState, useEffect, useMemo } = React;

  const ptBR = new Intl.DateTimeFormat('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
  const monthsPt = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const weekdays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  function getBusinessDays(year, month){
    const days = []; const m = month-1; const d = new Date(year, m, 1);
    while (d.getMonth()===m){ const wd = d.getDay(); if (wd>=1 && wd<=5) days.push(new Date(d)); d.setDate(d.getDate()+1); }
    return days;
  }
  function groupByWeeks(businessDays){
    const groups=[]; let cur=[]; let start=null;
    businessDays.forEach((date, idx)=>{ if(date.getDay()===1 || idx===0){ if(cur.length) groups.push({days:cur, start}); cur=[]; start=new Date(date);} cur.push(date); });
    if(cur.length) groups.push({days:cur, start}); return groups;
  }
  function weekCoverText(weekIdx, startDate, endDate){
    const s=startDate.getDate(), e=endDate.getDate(), m=monthsPt[startDate.getMonth()].toUpperCase();
    return { title:`SEMANA ${weekIdx}:`, subtitle:`(${s} A ${e} DE ${m})` };
  }
  function useLocalStorage(key, initial){
    const [state,setState] = React.useState(()=>{ try{ const raw=localStorage.getItem(key); return raw?JSON.parse(raw):initial; }catch(e){ return initial; } });
    React.useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(state)); }catch(_){} }, [key,state]);
    return [state,setState];
  }

  function Header({onExportPDF, onReset, footerText, setFooterText}){
    return (
      React.createElement('div', {className:'header'},
        React.createElement('div', {className:'brand'}, 'Calendário Editorial → PDF (v5.1)'),
        React.createElement('div', {className:'toolbar'},
          React.createElement('input', {type:'text', value:footerText, onChange:e=> setFooterText(e.target.value), style:{minWidth:260}, title:'Rodapé centralizado'}),
          React.createElement('button', {className:'btn primary', onClick:onExportPDF}, 'Exportar PDF'),
          React.createElement('button', {className:'btn', onClick:onReset}, 'Limpar tudo')
        )
      )
    )
  }

  function QuillPage({iso, bg, html, onChange, footerText}){
    const ref = React.useRef(null);
    React.useEffect(()=>{
      const toolbar = [
        [{ 'font': ['inter','helvetica','georgia','times'] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold','italic','underline','strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'align': [] }],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link','blockquote','code-block','clean']
      ];
      const Font = Quill.import('formats/font'); Font.whitelist = ['inter','helvetica','georgia','times']; Quill.register(Font, true);
      const quill = new Quill(ref.current.querySelector('.editor'), { theme:'snow', modules:{ toolbar } });
      if (html){ quill.root.innerHTML = html; }
      quill.on('text-change', ()=> onChange(iso, quill.root.innerHTML));
    }, []);
    return (
      React.createElement('div', {className:'page', 'data-date': iso, style:{background:bg}},
        React.createElement('div', {className:'page-tools'},
          React.createElement('span', null, 'Fundo desta página:'),
          React.createElement('input', {type:'color', value:bg, onChange:e=> onChange(iso, null, e.target.value)})
        ),
        React.createElement('div', {ref},
          React.createElement('div', {className:'toolbar ql-toolbar ql-snow'}),
          React.createElement('div', {className:'editor ql-container ql-snow'})
        ),
        React.createElement('div', {className:'footer-note'}, footerText)
      )
    )
  }

  function WeekCover({title, subtitle, footerText}){
    return (
      React.createElement('div', {className:'week-cover'},
        React.createElement('div', null,
          React.createElement('div', {className:'title'}, title),
          React.createElement('div', {className:'subtitle'}, subtitle)
        ),
        React.createElement('div', {className:'footer-note'}, footerText)
      )
    );
  }

  function App(){
    const today=new Date();
    const [year,setYear]=useLocalStorage('ed.year', today.getFullYear());
    const [month,setMonth]=useLocalStorage('ed.month', today.getMonth()+1);
    const [richTexts,setRichTexts]=useLocalStorage('ed.richTexts', {});
    const [pageBg,setPageBg]=useLocalStorage('ed.pageBg', {});
    const [footerText,setFooterText]=useLocalStorage('ed.footer', `TAGME mídias | ${today.getFullYear()}`);

    const businessDays=React.useMemo(()=>getBusinessDays(year,month),[year,month]);
    const dates=businessDays.map(d=>({date:d, iso:d.toISOString().slice(0,10)}));
    const weekGroups=React.useMemo(()=>groupByWeeks(businessDays),[businessDays]);

    function setTextFor(iso, html, newBg){
      if(html!==null) setRichTexts(prev=>({...prev,[iso]:html}));
      if(newBg!==undefined) setPageBg(prev=>({...prev,[iso]:newBg}));
    }
    function resetAll(){ setRichTexts({}); setPageBg({}); }

    async function exportPDF(){
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit:'px', format:'a4', hotfixes:["px_scaling"] });
      const toHide = document.querySelectorAll('.ql-toolbar, .page-tools');
      toHide.forEach(el=> el.classList.add('hide-export'));
      const nodes = document.querySelectorAll('.week-cover, .page');
      for(let i=0;i<nodes.length;i++){
        const el = nodes[i];
        let bg = '#ffffff';
        if (el.classList.contains('page')){
          const iso = el.getAttribute('data-date');
          bg = pageBg[iso] || '#ffffff';
          el.style.background = bg;
        }else{
          bg = '#000000';
          el.style.background = bg;
        }
        const canvas = await html2canvas(el, { scale:2, backgroundColor: bg });
        const img = canvas.toDataURL('image/png');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
        const w = canvas.width * ratio;
        const h = canvas.height * ratio;
        if (i>0) pdf.addPage();
        pdf.addImage(img, 'PNG', (pageWidth-w)/2, (pageHeight-h)/2, w, h);
      }
      toHide.forEach(el=> el.classList.remove('hide-export'));
      pdf.save(`Calendario_${String(month).padStart(2,'0')}-${year}.pdf`);
    }

    return (
      React.createElement(React.Fragment,null,
        React.createElement(Header, {onExportPDF:exportPDF, onReset:resetAll, footerText, setFooterText}),
        React.createElement('div', {className:'container'},
          React.createElement('div', {className:'card input'},
            React.createElement('h3', null, '1) Mês e Ano'),
            React.createElement('div', {style:{display:'flex', gap:'8px', alignItems:'center', marginBottom:10}},
              React.createElement('label', null, 'Mês'),
              React.createElement('select', {value:month, onChange:e=> setMonth(Number(e.target.value))},
                Array.from({length:12}, (_,i)=> React.createElement('option',{key:i+1, value:i+1}, String(i+1).padStart(2,'0')))
              ),
              React.createElement('label', null, 'Ano'),
              React.createElement('input', {type:'number', value:year, onChange:e=> setYear(Number(e.target.value)), style:{width:120}})
            ),
            React.createElement('h3', null, '2) Cole os textos (dias úteis)'),
            React.createElement('div', null,
              dates.map(({date, iso})=>(
                React.createElement('div', {key:iso, className:'day-item'},
                  React.createElement('div', {className:'day-title'},
                    React.createElement('div', null, `${weekdays[date.getDay()]} • ${ptBR.format(date)}`),
                    React.createElement('div', null, iso)
                  ),
                  React.createElement('textarea', {
                    className:'textarea',
                    placeholder:'Cole o texto deste dia',
                    value: stripHtml(richTexts[iso] || ''),
                    onChange: e=> setTextFor(iso, htmlFromPlain(e.target.value))
                  })
                )
              ))
            )
          ),
          React.createElement('div', {className:'card'},
            React.createElement('h3', null, '3) Pré-visualização (capas + páginas)'),
            React.createElement('div', {className:'preview'},
              weekGroups.length
              ? weekGroups.map((group, idx)=>{
                  const start = group.days[0];
                  const end = group.days[group.days.length-1];
                  const cover = weekCoverText(idx+1, start, end);
                  return React.createElement(React.Fragment, {key:idx},
                    React.createElement('div', {className:'week-header'}, `${cover.title} ${cover.subtitle}`),
                    React.createElement(WeekCover, {title: cover.title, subtitle: cover.subtitle, footerText}),
                    group.days.map(d=>{
                      const iso = d.toISOString().slice(0,10);
                      const bg = (typeof pageBg[iso] !== 'undefined') ? pageBg[iso] : '#ffffff';
                      return React.createElement(QuillPage, { key:iso, iso, bg, html: richTexts[iso] || '', onChange:setTextFor, footerText });
                    })
                  )
                })
              : React.createElement('div', null, 'Selecione um mês/ano para gerar automaticamente.')
            )
          )
        )
      )
    )
  }

  function stripHtml(html){ const tmp=document.createElement('div'); tmp.innerHTML=html; return tmp.textContent||tmp.innerText||''; }
  function htmlFromPlain(text){ const lines=(text||'').split(/\\r?\\n/).map(l=>`<p>${escapeHtml(l)}</p>`).join(''); return lines||'<p></p>'; }
  function escapeHtml(s){ return s.replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
})();
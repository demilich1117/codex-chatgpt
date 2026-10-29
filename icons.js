const paths = {
 archive:'M3 3h18v5H3ZM5 8v13h14V8M10 12h4', restore:'M3 3h18v5H3ZM5 8v13h14V8M12 17v-6m-3 3 3-3 3 3', trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
 menu:'M4 6h16M4 12h12M4 18h8', close:'m6 6 12 12M18 6 6 18',
 compose:'M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7M16 3l5 5M10 14l2-6 7-7 5 5-7 7-7 2Z',
 search:'M21 21l-5-5M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
 chat:'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2v-9.5A8.5 8.5 0 1 1 21 11.5Z',
 book:'M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z',
 sliders:'M4 6h6m4 0h6M4 12h2m4 0h10M4 18h10m4 0h2M10 3v6M6 9v6m8 0v6',
 plug:'M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-12 0ZM12 17v5',
 text:'M4 4h16M12 4v16m-4 0h8',
 settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 image:'M3 3h18v18H3ZM3 17l6-6 4 4 3-3 5 5M9 7h.01',
 grid:'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
 user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3',
 users:'M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M2 21v-2a8 8 0 0 1 16 0v2M18 3a4 4 0 0 1 0 8m2 3a6 6 0 0 1 2 5v2',
 chevron:'m9 5 7 7-7 7', more:'M4 12h.01M12 12h.01M20 12h.01',
 pin:'m9 3 6 0-1 6 4 4H6l4-4ZM12 13v8',
 plus:'M12 4v16M4 12h16', down:'m6 9 6 6 6-6',
 panel:'M3 3h18v18H3ZM9 3v18', history:'M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2',
 arrow:'m14 5-7 7 7 7', sun:'M12 3v1m0 16v1M3 12h1m16 0h1M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
};
export function icon(name) {
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.65');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
 const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]||paths.chat);svg.append(p);return svg;
}

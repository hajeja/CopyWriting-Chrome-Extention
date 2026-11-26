// Capture complete, visible announcement containers in the current document.
(() => {
  const selector = '.notice, .announcement, .banner, [role="alert"], [data-banner], [data-announcement]';
  const visible = el => {
    if (!el.isConnected || el.closest('[hidden],[inert],[aria-hidden="true"],nav,aside,footer,[role="navigation"],#drawer,table,[role="table"],[role="grid"]')) return false;
    const style = getComputedStyle(el), rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0 && el.getClientRects().length > 0;
  };
  const candidates = Array.from(document.querySelectorAll(selector)).filter(visible);
  // Keep announcement dates, while masking common contact and transaction identifiers.
  // The user still reviews the preview because personal names cannot be reliably detected.
  const redact = text => text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email removed]')
    .replace(/\b(?:Rp|IDR)\s*[\d.,]+/gi, '[amount removed]')
    .replace(/\b(?:[A-Z]+\d+\/)?(?:INV|PO|POR|TTF)[\s:/#-]*[A-Z0-9][A-Z0-9/_.-]*\d[A-Z0-9/_.-]*/gi, '[reference removed]')
    .replace(/\b(?:\+?62|0)\d[\d\s-]{7,}\d\b/g, '[phone removed]');
  // Keep the outermost matching container so its title, body, links and CTA are reviewed once.
  const elements = candidates.filter(el => !candidates.some(parent => parent !== el && parent.contains(el)))
    .map(element => ({element, text: redact((element.innerText || '').replace(/\r/g, '').replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim())}))
    .filter(item => item.text);
  const selected = elements.slice(0, 120), token = crypto.randomUUID();
  const components = item => {
    const selector='h1,h2,h3,h4,h5,h6,[role="heading"],p,button,[role="button"]';
    const blocks=Array.from(item.element.querySelectorAll?.(selector) || []);
    const title=Array.from(item.element.querySelectorAll?.('strong,b') || []).find(node=>!node.closest(selector));
    if(title)blocks.push(title);
    const ordered=blocks.filter(node=>visible(node) && !blocks.some(parent=>parent!==node && parent.contains(node)))
      .sort((a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1);
    const parts=ordered.map(node=>({type:node===title || node.matches('h1,h2,h3,h4,h5,h6,[role="heading"]')?'title':node.matches('button,[role="button"]')?'cta':'body',text:redact(node.innerText.trim())}));
    const flat=text=>text.replace(/\s+/g,' ').trim();
    // Never drop unstructured banner text while describing component boundaries.
    return parts.length && flat(parts.map(part=>part.text).join(' '))===flat(item.text) ? parts : [{type:'body',text:item.text}];
  };
  window.__astroCopyAudit = {token, elements:selected.map(item => item.element)};
  return {token, total:elements.length, items:selected.map((item,id) => ({id, text:item.text, kind:'banner',components:components(item)}))};
})()

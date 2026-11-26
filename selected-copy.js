// Standard DOM selections only. Never scrape the Sheets canvas, formula bar,
// accessibility mirror, page internals or clipboard to guess selected cells.
(() => {
  if (location.hostname === 'docs.google.com' && /^\/spreadsheets(?:\/|$)/.test(location.pathname)) {
    return {supported:false, reason:'Google Sheets cells cannot be read reliably by this extension. A supported Sheets selection integration is required. No content was sent.'};
  }
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return {supported:true,items:[]};
  const text = selection.toString().trim();
  if (!text) return {supported:true,items:[]};
  if (text.length > 12000) return {supported:false,reason:'The selection is too long. Select up to 12,000 characters.'};
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!element || element.closest('input,textarea,[contenteditable="true"]')) return {supported:false,reason:'Select rendered webpage text. Editable field contents are not supported.'};
  const token = crypto.randomUUID();
  window.__astroCopyAudit = {token, elements:[element]};
  return {supported:true, token, items:[{id:0,text,kind:'selected text',components:[{type:'body',text}],sourceLabel:'Selected webpage text'}]};
})()

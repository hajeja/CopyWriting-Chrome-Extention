const MENU_ID = 'check-astro-copy';
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => chrome.contextMenus.create({id:MENU_ID,title:'Audit Selected Copy',contexts:['selection']}));
});
chrome.contextMenus.onClicked.addListener((info,tab) => {
  if(info.menuItemId!==MENU_ID || !info.selectionText || tab?.windowId==null)return;
  const request={type:'AUDIT_SELECTED_COPY',text:info.selectionText,source:{tabId:tab.id,url:tab.url || ''},requestedAt:Date.now()};
  // Preserve the user gesture: open before awaiting anything.
  chrome.sidePanel.open({windowId:tab.windowId}).then(()=>chrome.runtime.sendMessage(request)).catch(()=>{
    // Panel still loading: the user can select their saved project and run Audit Selected Copy.
  });
});
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{});

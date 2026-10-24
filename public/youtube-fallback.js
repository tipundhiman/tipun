/* A useful fallback when the optional YouTube Data API is not configured. */
(function(){
  'use strict';
  const searchInApp=window.roYtSearch;
  if(typeof searchInApp!=='function')return;

  window.roYtSearch=async function(event){
    await searchInApp(event);
    const status=document.getElementById('roYtStatus');
    const input=document.getElementById('roYtQuery');
    const grid=document.getElementById('roYtGrid');
    if(!status||!input||!grid)return;
    const fallbackNeeded=/^YouTube unavailable:|^No embeddable videos found/.test(status.textContent||'');
    const query=input.value.trim();
    if(!fallbackNeeded||query.length<2)return;

    status.textContent='In-app video discovery is unavailable right now. You can search directly on YouTube.';
    const link=document.createElement('a');
    link.className='btn gold';
    link.href='https://www.youtube.com/results?search_query='+encodeURIComponent(query+' music');
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.textContent='↗ Continue on YouTube';
    grid.replaceChildren(link);
  };
})();

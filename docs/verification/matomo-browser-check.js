// Run with Playwright CLI run-code; see matomo-parity.md. Collector requests are intercepted.
async page => {
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  const setup = async page => {
  page.matomoRequests = [];
  page.googleRequests = [];
  page.on('request', request => {
    if (request.url().includes('/matomo.php')) page.matomoRequests.push({url: request.url(), body: request.postData()});
    if (/google-analytics|googletagmanager/.test(request.url())) page.googleRequests.push(request.url());
  });
  await page.route(/google-analytics|googletagmanager/, route => route.abort());
  await page.route('https://lb.se/matomo/matomo.php**', route => route.fulfill({status: 204}));
  await page.route('https://lb.se/matomo/matomo.js', route => route.fulfill({path: '/tmp/littb-matomo-tracker.js', contentType: 'application/javascript'}));
  await page.route('https://litteraturbanken.se/**', async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({url: 'http://127.0.0.1:3090' + url.pathname + url.search, maxRedirects: 0});
    await route.fulfill({response});
  });
  await page.goto('https://litteraturbanken.se/', {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => !!window.Matomo);
  await page.waitForTimeout(1000);
};
  const flows = async page => {
  const ledger = () => page.matomoRequests.map(r => {const p=new URLSearchParams(r.body || new URL(r.url).search);return {title:p.get('action_name'),url:p.get('url'),download:p.get('download'),link:p.get('link'),site:p.get('idsite')}});
  const results=[];
  const check=async(label, action, expected) => {
    const start=page.matomoRequests.length;
    await action(); await page.waitForTimeout(600);
    const events=ledger().slice(start);
    results.push({label,events,title:await page.title()});
    if (label === 'author' && events[0]?.title !== 'Författarprofil | Litteraturbanken') throw new Error(JSON.stringify({label, events}));
    if (label === 'search' && events[0]?.title !== 'Sök | Litteraturbanken') throw new Error(JSON.stringify({label, events}));
    if(events.length!==expected) throw new Error(JSON.stringify({label,expected,results}));
  };
  const navigate = path => page.evaluate(path => document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push(encodeURI(path)), path);
  await check('home to library by real link',()=>page.getByRole('link',{name:'Biblioteket',exact:true}).click(),1);
  await check('library filter',()=>navigate('/bibliotek?sort=nytillkommet'),0);
  await check('author',()=>navigate('/författare/SöderbergH'),1);
  await check('author subsection',()=>navigate('/författare/SöderbergH/titlar'),1);
  await check('reader initial',()=>navigate('/författare/SöderbergH/titlar/DoktorGlas/sida/-2/etext'),1);
  await check('reader next reused component',()=>navigate('/författare/SöderbergH/titlar/DoktorGlas/sida/-1/etext'),1);
  await check('reader query',()=>navigate('/författare/SöderbergH/titlar/DoktorGlas/sida/-1/etext?om-boken'),1);
  await check('reader duplicate navigation',()=>navigate('/författare/SöderbergH/titlar/DoktorGlas/sida/-1/etext?om-boken'),0);
  await check('back',()=>page.goBack(),1);
  await check('forward',()=>page.goForward(),1);
  await check('external marker',()=>navigate('/bibliotek#external'),0);
  await check('search',()=>navigate('/sök'),1);
  await check('search query',()=>navigate('/sök?q=glas'),0);
  await check('direct reader document',()=>page.goto('https://litteraturbanken.se/f%C3%B6rfattare/S%C3%B6derbergH/titlar/DoktorGlas/sida/-2/etext',{waitUntil:'domcontentloaded'}),1);
  await check('reader media switch',()=>navigate('/författare/SöderbergH/titlar/DoktorGlas/sida/-2/faksimil'),1);
  const redirect = await page.request.get('http://127.0.0.1:3090/sok', {maxRedirects:0});
  if (redirect.status() !== 308 || redirect.headers().location !== '/s%C3%B6k') throw new Error('Unexpected local redirect');
  // Playwright routing does not intercept subsequent requests in an HTTP redirect chain.
  // Verify the local redirect response, then begin a separate routed canonical navigation.
  await check('redirect destination /sök',()=>page.goto('https://litteraturbanken.se'+redirect.headers().location,{waitUntil:'domcontentloaded'}),1);
  await check('EPUB catalogue',()=>navigate('/epub?visa=epub&sort=popularitet'),1);
  const epub = page.locator('[data-library-epub-download]').first();
  await epub.waitFor();
  await epub.evaluate(a=>a.addEventListener('click',e=>e.preventDefault()));
  await check('real EPUB download link',()=>epub.click(),1);
  await check('home again',()=>navigate('/'),1);
  await page.evaluate(() => {
    for (const [id,href] of [['download','https://litteraturbanken.se/test.pdf'],['outbound','https://example.org/matomo-test']]) {
      const a=document.createElement('a');a.id='matomo-test-'+id;a.href=href;a.textContent=id;a.addEventListener('click',e=>e.preventDefault());document.body.append(a);
    }
  });
  await check('dynamic download',()=>page.locator('#matomo-test-download').click(),1);
  await check('dynamic outbound',()=>page.locator('#matomo-test-outbound').click(),1);
  await check('reload',()=>page.reload({waitUntil:'domcontentloaded'}),1);
  if(page.googleRequests.length) throw new Error('GA loaded');
  return {results, googleRequests:page.googleRequests.length, scripts:await page.locator('script[src*=matomo]').count()};
};
  const edges = async page => {
  const results = [];
  let release;
  const gate = new Promise(resolve => {release = resolve});
  await page.route('https://lb.se/matomo/matomo.js', async route => {await gate; await route.fulfill({path:'/tmp/littb-matomo-tracker.js',contentType:'application/javascript'})});
  page.matomoRequests.length=0;
  await page.goto('https://litteraturbanken.se/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => Array.isArray(window._paq) && window._paq.filter(c=>c[0]==='trackPageView').length===1);
  await page.getByRole('link',{name:'Biblioteket',exact:true}).click();
  await page.waitForFunction(() => Array.isArray(window._paq) && window._paq.filter(c=>c[0]==='trackPageView').length===2);
  if(page.matomoRequests.length!==0) throw new Error('collection before delayed script');
  release();
  await page.waitForFunction(()=>!!window.Matomo);
  await page.waitForTimeout(2000);
  if(page.matomoRequests.length!==2) throw new Error('delayed tracker lost or duplicated views: '+page.matomoRequests.length);
  results.push({case:'delayed tracker: home then library',requests:page.matomoRequests.length});
  await page.unroute('https://lb.se/matomo/matomo.js');
  await page.route('https://lb.se/matomo/matomo.js', route => route.fulfill({path:'/tmp/littb-matomo-tracker.js',contentType:'application/javascript'}));
  await page.route('https://stage.litteraturbanken.se/**',async route => {const url=new URL(route.request().url()); const response=await route.fetch({url:'http://127.0.0.1:3090'+url.pathname+url.search}); await route.fulfill({response})});
  for (const origin of ['https://stage.litteraturbanken.se','http://127.0.0.1:3090']) {
    const start=page.matomoRequests.length;
    await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => !!document.querySelector('#__nuxt')?.__vue_app__);
    await page.waitForTimeout(500);
    const state=await page.evaluate(()=>({scripts:document.querySelectorAll('script[src*=matomo]').length,queue:!!window._paq}));
    if(state.scripts || state.queue || page.matomoRequests.length!==start) throw new Error('unexpected tracking on '+origin);
    results.push({case:origin,...state,requests:0});
  }
  await page.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{get:()=> 'littb-snapshot'}));
  const start=page.matomoRequests.length;
  await page.goto('https://litteraturbanken.se/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => !!document.querySelector('#__nuxt')?.__vue_app__);
  await page.waitForTimeout(500);
  const snapshot=await page.evaluate(()=>({scripts:document.querySelectorAll('script[src*=matomo]').length,queue:!!window._paq}));
  if(snapshot.scripts || snapshot.queue || page.matomoRequests.length!==start) throw new Error('snapshot tracked');
  results.push({case:'littb-snapshot',...snapshot,requests:0});
  const html=await (await page.request.get('http://127.0.0.1:3090/')).text();
  if(/lb\.se\/matomo|googletagmanager|google-analytics/.test(html)) throw new Error('SSR contains tracker');
  results.push({case:'SSR HTML',trackerMarkup:false});
  return {results,googleRequests:page.googleRequests.length};
};
  await setup(page);
  if (page.matomoRequests.length !== 1) throw new Error('Initial SSR/hydrated visit must emit exactly once');
  return { flows: await flows(page), edges: await edges(page) };
}

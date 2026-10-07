// Playwright CLI callback; same local build/fixture setup as matomo-parity.md.
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

  await setup(page);
  const actions = () => page.matomoRequests.map(request => {
    const p = new URLSearchParams(request.body || new URL(request.url).search);
    return { url: p.get('url'), search:p.get('search'), category:p.get('search_cat'), count:p.get('search_count'), eventCategory:p.get('e_c'), event:p.get('e_a'), name:p.get('e_n'), value:p.get('e_v'), pageview:p.get('action_name') };
  });
  const navigate = path => page.evaluate(path => document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push(path),path);
  const results = [];
  const check = async (label, action, expected) => {
    const start = page.matomoRequests.length;
    await action();
    await page.waitForTimeout(1200);
    const events = actions().slice(start);
    results.push({label, events});
    if(events.length !== expected) throw new Error(JSON.stringify({label,expected,results}));
    return events;
  };
  const first = await check('direct search: one pageview and one separate search event',()=>page.goto('https://litteraturbanken.se/s%C3%B6k?fras=frihet',{waitUntil:'domcontentloaded'}),2);
  const initialSearch = first.filter(event => event.event === 'search');
  if(initialSearch.length !== 1 || initialSearch[0].eventCategory !== 'Text search' || initialSearch[0].name !== 'frihet' || Number(initialSearch[0].value) < 1 || first.filter(event=>event.pageview).length !== 1) throw new Error(JSON.stringify(first));
  await check('typing does not track',()=>page.getByLabel('Sökfras').fill('unsubmitted'),0);
  await check('advanced disclosure does not duplicate search',()=>page.locator('[data-search-advanced]').click(),0);
  const link = page.locator('#results td.match a').first();
  await link.evaluate(a=>a.addEventListener('click',e=>e.preventDefault()));
  const opened = await check('result click',()=>link.click({modifiers:['Meta']}),1);
  if(opened[0].event !== 'result_open:hit' || !opened[0].name) throw new Error(JSON.stringify(opened));
  const zero = await check('submitted zero-result search',async()=>{
    await page.getByLabel('Sökfras').fill('inga');
    await page.locator('.submit_form').evaluate(form=>form.requestSubmit());
  },1);
  if(zero[0].event!=='search' || zero[0].name!=='inga' || zero[0].value!=='0') throw new Error(JSON.stringify(zero));
  await check('new paginated search',()=>navigate('/s%C3%B6k?fras=overflow'),1);
  await check('next result page does not count as a new search',()=>page.locator('[data-library-pagination-next]').first().click(),0);
  await check('same route again',()=>navigate(new URL(page.url()).pathname+new URL(page.url()).search),0);
  await check('back to a different search',()=>navigate('/s%C3%B6k?fras=frihet'),1);
  await page.route('**/api/v2/text-search/results',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await check('failure is not a zero-result search',()=>navigate('/s%C3%B6k?fras=failed-query'),0);
  await page.unroute('**/api/v2/text-search/results');
  if(actions().some(event=>event.search!==null)) throw new Error('Text searches must not enter the library Site Search table');
  if(page.googleRequests.length) throw new Error('Google requested');
  return {results,googleRequests:page.googleRequests.length};
}

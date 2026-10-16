import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseSync } from '@babel/core'
import lodash from 'lodash'

const require = createRequire(import.meta.url)
const { compileSearchTextFilter } = require(process.argv[2])
const source = readFileSync('app/scripts/services.js', 'utf8')
const ast = parseSync(source, { sourceType: 'module', configFile: false, babelrc: false })
const registration = ast.program.body.find(node => node.type === 'ExpressionStatement' &&
    node.expression.arguments?.[0]?.value === 'SearchData')
const factory = registration.expression.arguments[1]
const requests = []
const http = config => {
    requests.push(config)
    return Promise.resolve({data: {data: [], hits: 0, total_highlights: 0, author_aggregation: []}})
}
const quiet = { log() {} }
const create = new Function('_', 'angular', 'c', 'console', 'STRIX_URL', 'compileSearchTextFilter',
    `return (${source.slice(factory.start, factory.end)})`)(lodash, {noop() {}}, quiet, quiet, '/api', compileSearchTextFilter)
const SearchData = create({}, {}, http, {})
const row = {metadata: {authors:[{authorid:'Example'}],titleid:'Book',mediatype:'etext',lbworkid:'lb1'}, highlight:{match:[{attrs:{wid:1,n:1}}]}}

for (const filter of [
    {'provenance.library':['SA'], 'authors>authorid':['Lo-JohanssonI']},
    {'provenance.library':['SVS'], keyword:['A&B']},
    '(provenance.library:SA OR authors>(authorid:SvenskaAkademien))',
    '"Svenska Akademien" OR keyword:"A&B"'
]) {
    let params = {query:'ord', text_filter:filter, work_ids:'lb1,lb2'}
    const expected = compileSearchTextFilter(filter)
    for (let round = 0; round < 3; round++) {
        requests.length = 0
        const search = new SearchData()
        search.compactLeftContext = () => {}
        search.decorateData = () => []
        search.currentParams = params
        const before = JSON.stringify(params)
        await search.searchWorks(params)
        assert.equal(JSON.stringify(params), before, "search must not mutate link state")
        assert.equal(requests.length, 2)
        for (const request of requests) {
            assert.deepEqual(request.params.text_filter, expected, `filter preserved on round ${round}`)
            assert.equal(request.params.work_ids, 'lb1,lb2')
        }
        const url = new URL(search.parseUrls(row, 0), 'https://example.test')
        params = Object.fromEntries([...url.searchParams].filter(([k]) => k.startsWith('s_')).map(([k,v]) => [k.slice(2),v]))
    }
}
console.log('SearchData result/count and Reader filter round trips: ok')

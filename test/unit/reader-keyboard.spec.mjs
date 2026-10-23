import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Exercise the actual legacy handler, including its input/modifier guards.
const source = readFileSync('app/scripts/components/reader/reading_controller.js', 'utf8')
const handler = source.slice(source.indexOf('const onKeyDown = function'), source.indexOf('$document.on("keydown", onKeyDown)'))
function press({ width = 1000, content = width, x = 0, tag = 'BODY', modal = false, key = 'ArrowRight', ...modifiers } = {}) {
    const calls = []
    const context = {
        document: { activeElement: { tagName: tag }, body: { classList: { contains: () => modal } }, documentElement: { clientWidth: width, scrollWidth: content } },
        $window: { scrollX: x, innerWidth: 1000 },
        $rootElement: { prop: () => content },
        $scope: { $apply: fn => fn() },
        ctrl: { nextPage: () => calls.push('next'), prevPage: () => calls.push('prev') },
        event: { key, ...modifiers }
    }
    vm.runInNewContext(handler + '\nonKeyDown(event)', context)
    return calls
}
assert.deepEqual(press(), ['next'])
assert.deepEqual(press({ width: 985 }), ['next'], 'vertical scrollbar must not block page turns')
assert.deepEqual(press({ width: 985, content: 1600 }), [], 'pan a wide page first')
assert.deepEqual(press({ width: 985, content: 1600, x: 615 }), ['next'])
assert.deepEqual(press({ width: 985, content: 1600, x: 614.5 }), ['next'], 'fractional scroll positions')
assert.deepEqual(press({ width: 985, content: 1600, x: 600 }), [])
assert.deepEqual(press({ width: 985, key: 'ArrowLeft' }), ['prev'])
assert.deepEqual(press({ content: 1600, shiftKey: true }), ['next'])
for (const tag of ['INPUT', 'TEXTAREA']) assert.deepEqual(press({ tag }), [])
for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { modal: true }]) assert.deepEqual(press(modifiers), [])
console.log('Reader keyboard regression tests passed')

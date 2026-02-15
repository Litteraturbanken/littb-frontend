import templateUrl from "../../../views/sla/biblinfo.html?url"

const angular = window.angular
const _ = window._
const littb = angular.module("littbApp")

class SlaBiblinfoCtrl {
    static $inject = ["backend"]

    constructor(backend) {
        this.backend = backend
    }

    $onInit() {
        this._limit = true
        this.showHit = 0
        this.searching = false
        this.wf = ""
        this.submit()
    }

    showAll() {
        this._limit = false
    }

    increment() {
        this._limit = true
        if (this.entries != null && this.entries[this.showHit + 1]) {
            this.showHit++
        }
    }

    decrement() {
        this._limit = true
        if (this.showHit) {
            this.showHit--
        }
    }

    getEntries() {
        if (this._limit) {
            return [this.entries != null ? this.entries[this.showHit] : undefined]
        } else {
            return this.entries
        }
    }

    getColumn1(entry) {
        const pairs = _.toPairs(entry)
        const splitAt = Math.floor(pairs.length / 2)
        return _.fromPairs(pairs.slice(0, +splitAt + 1 || undefined))
    }

    getColumn2(entry) {
        const pairs = _.toPairs(entry)
        const splitAt = Math.floor(pairs.length / 2)
        return _.fromPairs(pairs.slice(splitAt + 1))
    }

    submit() {
        const names = ["manus", "tryckt_material", "annat_tryckt", "forskning"]
        const params = names.filter(x => this[x]).map(x => `resurs=${x}`)
        let wf
        if (this.wf) {
            wf = this.wf
        }
        this.searching = true

        return this.backend.getBiblinfo(params.join("&"), wf).then((data) => {
            this.entries = data
            this.num_hits = data.length
            this.searching = false
        })
    }
}

littb.component("slaBiblinfo", {
    templateUrl,
    controller: SlaBiblinfoCtrl
})

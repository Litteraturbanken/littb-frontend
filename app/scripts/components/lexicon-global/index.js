const angular = window.angular
const $ = window.$
const c = typeof console !== "undefined" && console !== null ? console : { log: angular.noop }
const littb = angular.module("littbApp")

class LexiconGlobalCtrl {
    static $inject = ["$scope", "backend", "$location", "$rootScope", "$q", "$timeout", "$uibModal", "util", "$window"]

    constructor($scope, backend, $location, $rootScope, $q, $timeout, $uibModal, util, $window) {
        this.$scope = $scope
        this.backend = backend
        this.$location = $location
        this.$rootScope = $rootScope
        this.$q = $q
        this.$timeout = $timeout
        this.$uibModal = $uibModal
        this.util = util
        this.$window = $window
    }

    $onInit() {
        const s = this.$scope
        s.dict_not_found = null
        s.dict_searching = false

        let modal = null

        s.keydown = (event) => {
            if (event.keyCode === 40) {
                if ($(".input_container .dropdown-menu").is(":hidden")) {
                    s.$broadcast("open", s.lex_article)
                }
            } else if (event.keyCode === 27) {
                s.lex_article = null
            }
        }

        s.showModal = () => {
            c.log("showModal", modal)
            s.lexemes = s.lex_article.lexemes
            if (!modal) {
                s.$broadcast("blur")
                modal = this.$uibModal.open({
                    templateUrl: "so_modal_template.html",
                    scope: s
                })
                modal.result.then(
                    () => s.closeModal(),
                    () => s.closeModal()
                )
            }
        }

        s.clickX = () => modal.close()

        s.closeModal = () => {
            s.lex_article = null
            s.lexid = null
            modal = null
        }

        const reportDictError = () => {
            s.$emit("notify", "Hittade inget uppslag")
            s.dict_searching = false
        }

        s.lexid = null

        this.$rootScope.$on("search_dict", (event, lemma, id, doSearchId) => {
            c.log("search_dict event", lemma, id, doSearchId)
            if (doSearchId) {
                s.lexid = false
            }

            s.dict_searching = true

            const def = this.backend.searchLexicon(lemma, id, false, doSearchId, true)
            def.catch(() => {
                c.log("searchLexicon catch")
                reportDictError()
            })

            def.then((data) => {
                c.log("searchLexicon then", data)
                s.dict_searching = false

                let result = data[0]
                for (let obj of data) {
                    if (obj.baseform === lemma) {
                        result = obj
                        continue
                    }
                }

                s.lex_article = result
                if (id) {
                    s.lexid = id
                }
                s.showModal()
            })
        })

        s.getWords = (val) => {
            c.log("getWords", val)
            if (!val) return
            s.dict_searching = true
            const def = this.backend.searchLexicon(val, null, true)
            const timeout = this.$timeout(angular.noop, 800)
            def.catch(() => {
                s.dict_searching = false
                reportDictError()
            })
            this.$q.all([def, timeout]).then(() => (s.dict_searching = false))
            return def
        }

        this.util.setupHashComplex(s, [
            {
                key: "so",
                expr: "lex_article.baseform",
                val_in(val) {
                    const id = this.$location.search().lex
                    c.log("val_in", val, id)
                    return s.$emit("search_dict", val, id, false)
                },
                replace: false
            },
            {
                key: "lex",
                scope_name: "lexid",
                replace: false
            }
        ])
    }
}

littb.component("lexiconGlobal", {
    template: `
        <div style="display: none" class="word_search" ng-class="{searching : dict_searching}">
            <div class="input_container">
                <input
                    type="text"
                    ng-model="lex_article"
                    focusable
                    placeholder="Slå i Svensk ordbok"
                    typeahead-on-select="showModal(lex_article)"
                    typeahead-wait-ms="300"
                    typeahead="article as article.baseform for article in getWords($viewValue)"
                    ng-keydown="keydown($event)"
                    typeahead-trigger
                />

                <span
                    class="so_spinner"
                    us-spinner="{lines : 8 ,radius:4, width:1.5, length: 2.5}"
                ></span>
            </div>
        </div>
    `,
    controller: LexiconGlobalCtrl
})

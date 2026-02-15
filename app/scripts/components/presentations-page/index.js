import templateUrl from "../../../views/presentations.html?url"

const angular = window.angular
const $ = window.$
const littb = angular.module("littbApp")

class PresentationsPageCtrl {
    static $inject = ["$scope", "$http", "$location", "util"]

    constructor($scope, $http, $location, util) {
        this.$scope = $scope
        this.$http = $http
        this.$location = $location
        this.util = util
    }

    $onInit() {
        const url = "/red/presentationer/presentationerForfattare.html"
        this.isMain = true
        this.$http.get(url).then(({ data }) => {
            this.doc = data
            // setupHash requires $scope for $watch support
            this.util.setupHash(this.$scope, {
                ankare: (val) => {
                    if (!val) {
                        $(window).scrollTop(0)
                        return
                    }
                    $(window).scrollTop($(`#${val}`).offset().top)
                }
            })
        })
    }
}

littb.component("presentationsPage", {
    templateUrl,
    controller: PresentationsPageCtrl
})

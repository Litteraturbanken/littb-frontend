const angular = window.angular
const littb = angular.module("littbApp")

class HistoryPageCtrl {
    static $inject = ["authors"]

    constructor(authors) {
        this._authors = authors
    }

    $onInit() {
        this.lastPageViews = JSON.parse(localStorage.getItem("lastPageViews")) || []
        this._authors.then(([authorList, authorsById]) => {
            this.authorsById = authorsById
        })
    }
}

littb.component("historyPage", {
    template: `
        <div>
            <h1>Senast lästa verk</h1>
            <ul ng-if="$ctrl.authorsById">
                <li ng-repeat="pageview in $ctrl.lastPageViews">
                    <a ng-href="{{pageview.url}}">
                        <span>{{$ctrl.authorsById[pageview.author].full_name}}</span> –
                        <span class="">{{pageview.label}}</span>
                    </a>
                </li>
            </ul>
        </div>
    `,
    controller: HistoryPageCtrl
})

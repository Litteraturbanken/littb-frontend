import templateUrl from "../../../views/contactForm.html?url"

const angular = window.angular
const littb = angular.module("littbApp")

class ContactFormCtrl {
    static $inject = ["backend", "$timeout", "$location"]

    constructor(backend, $timeout, $location) {
        this.backend = backend
        this.$timeout = $timeout
        this.$location = $location
    }

    $onInit() {
        const isSOL = this.$location.search().sol != null
        const fromSchool = this.$location.search().skola != null
        this._fromSchool = fromSchool

        if (isSOL) {
            this.message = "[Ang. Översättarlexikon]\n\n"
        }

        this.showContact = false
        this.showNewsletter = false
        this.showError = false
    }

    submitContactForm() {
        let msg
        if (this._fromSchool) {
            msg = `[skola] ${this.message}`
        } else {
            msg = this.message
        }
        this.isLoading = true
        return this.backend.submitContactForm(this.name, this.email, msg, this._isSOL).then(() => {
            this.isLoading = false
            this.showContact = true
            this._done()
        }, () => this._err())
    }

    subscribe() {
        const msg = this.newsletterEmail + " vill bli tillagd på utskickslistan."
        this.backend.submitContactForm("Utskickslista", this.newsletterEmail, msg).then(() => {
            this.showNewsletter = true
            this._done()
        }, () => this._err())
    }

    _done() {
        this.$timeout(() => {
            this.showContact = false
            this.showNewsletter = false
            this.name = null
            this.email = null
            this.message = null
        }, 4000)
    }

    _err() {
        this.showError = true
        this.showContact = false
        this.showNewsletter = false
        this.isLoading = false
        this.$timeout(() => (this.showError = false), 4000)
    }
}

littb.component("contactForm", {
    templateUrl,
    controller: ContactFormCtrl
})

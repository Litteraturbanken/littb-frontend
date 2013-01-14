'use strict';

describe('Controller: AuthorListCtrl', function() {

  // load the controller's module
  beforeEach(module('littbApp'));

  var AuthorListCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function($controller) {
    scope = {};
    AuthorListCtrl = $controller('AuthorListCtrl', {
      $scope: scope
    });
  }));

  it('should attach a list of awesomeThings to the scope', function() {
    expect(scope.awesomeThings.length).toBe(3);
  });
});

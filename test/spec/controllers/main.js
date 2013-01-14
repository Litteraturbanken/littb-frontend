'use strict';

describe('Controller: ListCtrl', function() {

  // load the controller's module
  beforeEach(module('littbApp'));

  var ListCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function($controller) {
    scope = {};
    ListCtrl = $controller('ListCtrl', {
      $scope: scope
    });
  }));

  it('should flatten to letterArray the string below.', function() {
    var flattened = _.flatten(scope.letterArray, true);
    expect(flattened.join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ");
  });
});

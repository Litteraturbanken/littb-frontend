describe('authors', function() {
  var rows;
  beforeEach(function() {
    browser.get('http://localhost:9000/#!/forfattare');
    rows = element.all(by.repeater('row in rowByLetter[selectedLetter] || rows | filter:authorFilter'))
  })
  it('should show the correct amount of authors', function() {

    rows.then(function() {
      expect(rows.count()).toEqual(360)
    })
    
  });
    
  it('should filter using the input', function() {
    element(by.model('authorFilter')).sendKeys('adel');
    rows.then(function() {
      expect(rows.count()).toEqual(1)
    })
  })

    // expect(greeting.getText()).toEqual('Hello Julie!');



  // describe('todo list', function() {
  //   var todoList;

  //   beforeEach(function() {
  //     browser.get('http://www.angularjs.org');

  //     todoList = element.all(by.repeater('todo in todos'));
  //   });

  //   it('should list todos', function() {
  //     expect(todoList.count()).toEqual(2);
  //     expect(todoList.get(1).getText()).toEqual('build an angular app');
  //   });

  //   it('should add a todo', function() {
  //     var addTodo = element(by.model('todoText'));
  //     var addButton = element(by.css('[value="add"]'));

  //     addTodo.sendKeys('write a protractor test');
  //     addButton.click();

  //     expect(todoList.count()).toEqual(3);
  //     expect(todoList.get(2).getText()).toEqual('write a protractor test');
  //   });
  // });
});
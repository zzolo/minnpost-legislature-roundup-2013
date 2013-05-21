(function(app, $, undefined) {
  // Create basic models for bills and categories
  var Bill = Backbone.Model.extend({
    sessionBegin: function() {
      return new Date(2012, 01 - 1, 24);
    },
    
    sessionEnd: function() {
      return new Date(2012, 05 - 1, 10);
    },
    
    convertDate: function(string) {
      var dateArray = string.replace(/( [0-9]{2}:[0-9]{2}:[0-9]{2}$)/, '').split('-');
      if (_.isArray(dateArray) && dateArray.length == 3) {
        return new Date(dateArray[0], dateArray[1] - 1, dateArray[2]);
      }
      else {
        return new Date();
      }
    },
    
    getDays: function() {
      var start = this.convertDate(this.get('start_date'));
      var end = this.convertDate(this.get('end_date'));
      var days = 12 * 60 * 60 * 1000;
      
      // Add one to ensure it is a non-zero result.
      return Math.ceil(((end.getTime() + 1) - start.getTime()) / days);
    },
    
    getIntervalPercentage: function() {
      var days = 12 * 60 * 60 * 1000;
      var sessionBegin = this.sessionBegin();
      var sessionEnd = this.sessionEnd();
      var sessionLength = Math.ceil(((sessionEnd.getTime() + 1) - sessionBegin.getTime()) / days);
      var theseDays = (this.getDays() < 3) ? 3 : this.getDays();
      
      // Get percentage of length but don't go over 1.
      return (theseDays > sessionLength) ? 1 : theseDays / sessionLength;
    },
    
    getStartPercentage: function() {
      var days = 12 * 60 * 60 * 1000;
      var sessionBegin = this.sessionBegin();
      var sessionEnd = this.sessionEnd();
      var start = this.convertDate(this.get('start_date'));
      
      var startInterval = Math.ceil(((start.getTime() + 1) - sessionBegin.getTime()) / days);
      var sessionLength = Math.ceil(((sessionEnd.getTime() + 1) - sessionBegin.getTime()) / days);
      
      // Add one to ensure it is a non-zero result.  If start time is
      // before the session start time, just assume 0.
      return (start.getTime() < sessionBegin.getTime()) ? 0 : startInterval / sessionLength;
    },
    
    getSponsorData: function(author, type) {
      var sponsorlist = (type == 'representative') ? 'house_sponsors' : 'senate_sponsors';
      var sponsors = this.get(sponsorlist);

      if (_.isArray(sponsors)) {
        for (var s in sponsors) {
          if (sponsors[s][0] == author) {
            return sponsors[s];
          }
        }
      }
    }
  });
  
  // Collections
  var Bills = Backbone.Collection.extend({
    model: Bill,
    
    filterCategory: function (category) {
      return this.filter(function (bill) {
        if (_.isArray(bill.get('categories'))) {
          var found = _.filter(bill.get('categories'), function(c) {
            return c == category;
          });
          return !_.isEmpty(found);
        }
        else {
          return false;
        }
      });
    },
    
    filterAuthor: function(author, type) {
      var sponsorlist = (type == 'representative') ? 'house_sponsors' : 'senate_sponsors';
      
      if (!_.isArray(author)) {
        author = [author];
      }

      return this.filter(function (bill) {
        if (_.isArray(bill.get(sponsorlist))) {
          var found = _.filter(bill.get(sponsorlist), function(s) {
            return (_.indexOf(author, s[0]) === -1) ? false : true;
          });
          return !_.isEmpty(found);
        }
        else {
          return false;
        }
      });
    },
    
    comparator: function(bill) {
      return (bill.get('bill_status') == 'pending') ? 'zzz' : bill.get('bill_status');
    }
  });
  
  // Single bill view.
  var BillView = Backbone.View.extend({
    initialize: function(d) {
      // Every function that uses 'this' as the current object should be in here
      _.bindAll(this, 'render');
      
      this.model = d.model || new Bill();
    },

    render: function() {
      // Render template
      app.getTemplate('template-bill', function(template) {
        $(this.el).html(template({ bill: this.model }));
        
        // Figure out heights
        var billH = $('.bill-details-wrapper').height();
        var listH = $('#bills-list-container').height();
        if (listH > billH) {
          $('.bill-details-wrapper').height(listH);
        }
      }, this);
      return this;
    }
  });
  
  // Bills list view
  var BillsListView = Backbone.View.extend({
    categoryContainer: $('#bill-category-container'),
    listContainer: $('#bills-list-container'),
    
    events: {
      'click .show-bill': 'showBill',
      'submit form#address-chooser-form': 'showByAddress'
    },
  
    initialize: function(d) {
      // Every function that uses 'this' as the current object should be in here
      _.bindAll(this, 'render', 'showBill', 'showFirstBill', 'activateBill', 'showByAddress', 'filterCategory');
      
      this.collection = d.collection || new Bills();
      this.fullCollection = new Bills(this.collection.models);
      this.billView = new BillView({ el: $('#bill-detail-container') });
    },

    render: function() {
      // Render template
      app.getTemplate('template-bill-list', function(template) {
        this.listContainer.html(template({ bills: this.collection.models }));
  
        // Figure if we are scrolling.  Height on ul is not working,
        // so we count the li's.  :(
        var size = $('.bills-list ul li').size();
        if (size > 16) {
          $('.bills-list').addClass('is-scrolling');
        }
      }, this);
      return this;
    },
    
    showBill: function(e) {
      e.preventDefault();
      var thisElem = $(e.currentTarget);
      this.billView.model = this.collection.get(thisElem.attr('data-id'));
      this.activateBill(thisElem);
      this.billView.render();
      this.activateCategoryLinks();
      return this;
    },
    
    showFirstBill: function() {
      this.billView.model = this.collection.at(0);
      this.activateBill($('[data-id="' + this.billView.model.cid + '"]'));
      this.billView.render();
      this.activateCategoryLinks();
      return this;
    },
    
    activateCategoryLinks: function() {
      var that = this;
      // Hookup category links
      $('.bill-categories ul a').click(function(e) {
        e.preventDefault();
        that.filterCategory($(this).attr('data-category'));
      });
      
      return that;
    },
    
    activateBill: function(element) {
      $('.show-bill').removeClass('active');
      element.addClass('active');
      return this;
    },
    
    showCategory: function(data) {
      // Render template
      app.getTemplate('template-category', function(template) {
        this.categoryContainer.html(template(data));
      }, this);
      return this;
    },
    
    showError: function(message) {
      $('<div class="address-error">' + message + '</div>').hide().prependTo('#address-chooser-form').fadeIn();
    },
    
    removeErrors: function() {
      $('#address-chooser-form .address-error').fadeOut('fast');
    },
    
    showByAddress: function(e) {
      e.preventDefault();
      var thisList = this;
      var thisElem = $(e.currentTarget);
      var type = $('input:radio[name="author_type"]:checked').val();
      var address = $('input#address-chooser-address').val();
      var mnBounds = [43.499356, -97.239209, 49.384358, -89.489226];
      
      // Remove any errors
      this.removeErrors();
      
      // Geocode address using Mapquest becuase its terms of service are more open,
      // though its geocoding is not the best.
      $.getJSON('http://open.mapquestapi.com/nominatim/v1/search?format=json&json_callback=?&countrycodes=us&limit=1&q=' + encodeURI(address), function(value) {
        // Use first response
        value = value[0];
        
        // Check response
        if (value === undefined) {
          thisList.showError('We were unable turn your search terms, ' + address + ', into a geographical location.  Please be more specific, such as including ZIP code.');
        }
        // Check we are still mostly in Minnesota
        else if (value.lat < mnBounds[0] || value.lat > mnBounds[2] || value.lon < mnBounds[1] || value.lon > mnBounds[3]) {
          thisList.showError('Sorry, but what you are looking for is outside of Minnesota.');
        }
        else {
          // Send to Open States service
          var APIKEY = '49c5c72c157d4b37892ddb52c63d06be';
          var request = 'http://openstates.org/api/v1/legislators/geo/?long=' + encodeURI(value.lon) + '&lat=' + encodeURI(value.lat) + '&apikey=' + encodeURI(APIKEY) + '&callback=?';
          $.getJSON(request, function(data) {
            var d;
            var names = [];
            var chamber = (type == 'representative') ? 'lower' : 'upper';
            
            // Find relevant names
            for (d in data) {
              if (data[d].active && data[d].level == 'state' && data[d].chamber == chamber) {
                names.push(data[d].full_name);
              }
            }

            // Filter by representative
            if (!_.isEmpty(names)) {
              // Get last name found
              var name = names[names.length - 1];
              var filtered = thisList.filterAuthor(name, type, true);
              if (_.isEmpty(filtered)) {
                thisList.showError('There were no bills found that were sponsored by your legislator(s): <em>' + name + '</em>.  This could be an issue with the data quality and may not accurately reflect the activities of these legislator(s).');
              }
              else {
                $('#address-chooser').slideUp('fast');
                $('#category-details').slideDown('fast');
              }
            }
            else {
              thisList.showError('We could not find a representative for that address.');
            }
          });
        }
      });
    },
    
    filterAuthor: function(author, type) {
      var filtered = this.fullCollection.filterAuthor(author, type);

      if (_.isEmpty(filtered)) {
        // TODO: show empty message
      }
      else {
        this.collection.reset(filtered);
        this.showCategory({
          category: author, 
          sponsor: this.collection.at(0).getSponsorData(author, type)
        });
        this.render();
        this.showFirstBill();
      }
      
      return filtered;
    },
    
    filterCategory: function(category) {
      var filtered = this.fullCollection.filterCategory(category);
      
      if (_.isEmpty(filtered)) {
        // TODO: show empty message
      }
      else {
        this.collection.reset(filtered);
        var image = 'https://s3.amazonaws.com/data.minnpost/projects/mn-legislature-roundup-2012/icons/' + 
          this.getCatIcon(category) + '.png';
        this.showCategory({ category: category, image_url: image });
        this.render();
        this.showFirstBill();
      }
    },
    
    getCatIcon: function(cat) {
      icons = {
        'Government': 'noun_project_1761',
        'Energy and Technology': 'noun_project_2075',
        'Housing and Property': 'noun_project_1439',
        'Campaign Finance and Election Issues': 'noun_project_287',
        'Reproductive Issues': 'noun_project_626',
        'Environment and Recreation': 'noun_project_479',
        'Health and Science': 'noun_project_1868',
        'Military': 'noun_project_1697',
        'Welfare and poverty': 'noun_project_620',
        'Budget, Spending and Taxes': 'noun_project_925',
        'Insurance': 'noun_project_1675',
        'Business and Economy': 'noun_project_1640',
        'Education': 'noun_project_1051',
        'Immigration': 'noun_project_31',
        'Agriculture and Food': 'noun_project_741',
        'Arts and Humanities': 'noun_project_1554',
        'Guns': 'noun_project_138',
        'Gambling and Gaming': 'noun_project_1740',
        'Crime and Drugs': 'noun_project_2039',
        'Social Issues': 'noun_project_288',
        'Vetoed': 'noun_project_558',
        'Controversial': 'noun_project_1635',
        'Legal': 'noun_project_1004',
        'Transportation': 'noun_project_97'
      }
      
      if (typeof icons[cat] != 'undefined') {
        return icons[cat];
      }
      else {
        return '';
      }
    }
  });
  
  // Bubble visualization

  // Visualize categories with a bubble layout.
  function visCategories(categories, billList) {
    var height = 650;
    var width = 975;
    var bubbleMinRadius = 6;
    var bubbleMaxRadius = 60;
    var xBubbleSpacing = 50;
    var yBubbleSpacing = 150;
    var xPos = -50;
    var yPos = 165;
    var bubbleColors = ['156DAC', '1571A6', '1575A0', '15799A', '157D94', '15828E', '158688', '158A82', '158E7D', '159277', '159771', '159B6B', '159F65', '15A35F', '15A759', '15AC54'];
    var reordered = [];
    var customColors = { 'Vetoed': '323232', 'Controversial': 'E31C2D' };
    var customSorts = { 'Vetoed': -1, 'Controversial': -2 };
    
    // Find the max number in a category
    var maxBills = 1;
    for (var c in categories) {
      maxBills = (categories[c].length > maxBills) ? categories[c].length : maxBills;
      // For re-ordering
      reordered.push({ name: c, bills: categories[c]});
    }
    
    // Sort categories by number of bills
    reordered = reordered.sort(function(a, b) {
      // Handle custom sorts, otherwise just sort by length.
      if (typeof customSorts[a.name] != 'undefined') {
        return 0 - customSorts[a.name];
      }
      else if (typeof customSorts[b.name] != 'undefined') {
        return customSorts[b.name];
      }
      else {
        return b.bills.length - a.bills.length;
      }
    })
    
    // Base Raphael canvas
    var bubbleChart = Raphael(document.getElementById("bubble-chart"), width, height);
  
    // Create bubbles
    for (var i in reordered) {
      // Make area proportional given max bills in a category.  This could
      // be a lot more elegant and efficient.
      var percentage = reordered[i].bills.length / maxBills;
      var maxArea = bubbleMaxRadius * bubbleMaxRadius * Math.PI;
      var minArea = bubbleMaxRadius * bubbleMinRadius * Math.PI;
      var thisArea = (percentage * (maxArea - minArea)) + minArea;
      var radius = Math.sqrt(thisArea / Math.PI);
      var color = bubbleColors[Math.floor(Math.random() * bubbleColors.length)];
      
      // Custom color
      if (typeof customColors[reordered[i].name] != 'undefined') {
        color = customColors[reordered[i].name];
      }
      
      // Update x and y positions
      xPos += 150;
      if (xPos + radius >= width) {
        xPos = 100;
        yPos += yBubbleSpacing;
      }
  
      // Create circle with proportional radius and starting in
      // a random spot (as it will be positioned later).  Attached
      // data for the position and radius.
      var circle = bubbleChart.circle(Math.random() * (width - radius), Math.random() * (height - radius), 0)
        .data('name', reordered[i].name)
        .data('spreadX', xPos)
        .data('spreadY', yPos - radius)
        .data('radius', radius)
        .attr('fill', Raphael.rgb(hexToRGB(color, 'R'), hexToRGB(color, 'G'), hexToRGB(color, 'B')))
        .attr('opacity', '0.7')
        .attr('stroke-width', 0.5)
        .attr('cursor', 'pointer');
      
      // Animate the circle to its full radius
      var enlarge = Raphael.animation({'r': radius}, 1000, 'easeIn');
      circle.animate(enlarge.delay(Math.random() * 1000));
        
      // Text for each bubble, attaching data for spreading.
      var text = bubbleChart.text(circle.attrs.cx, circle.attrs.cy)
        .attr('font-size', 12)
        .attr('fill', '#444')
        .attr('cursor', 'pointer')
        .data('spreadX', xPos)
        .data('spreadY', yPos + 20)
        .data('name', reordered[i].name);
      text = wrapText(reordered[i].name, text);
      
      // Create image for for the bubble.  A slight offset
      // on spread for centering.
      var image = billList.getCatIcon(reordered[i].name);
      var image = bubbleChart.image('https://s3.amazonaws.com/data.minnpost/projects/mn-legislature-roundup-2012/icons/' + image + '.png', 
        Math.random() * (width - radius), Math.random() * (height - radius), 
        radius * .9, radius * .9)
        .attr('opacity', '0.1')
        .attr('cursor', 'pointer')
        .data('spreadX', xPos - (radius * .5) + 1)
        .data('spreadY', yPos - (radius * 1.5) + 1)
        .data('name', reordered[i].name);
      
      // Fade in image
      var fadeIn = Raphael.animation({'opacity': '0.6'}, 1000, 'easeIn');
      image.animate(fadeIn.delay(Math.random() * 1000));
      
      // Create set for handling events.  The this in the
      // event seems to refer to the specific element
      // and not the event.  Also, we need to use
      // closure to be able to refer to all the objects
      // on events.
      var setIt = (function(paper, bL, c, i, t) {
        return function() {
          var set = paper.set();
          set.push(c ).push(i).push(t)
            .mouseover(function() {
              c.attr('opacity', '1.0');
              i.attr('opacity', '1.0');
            })
            .mouseout(function() {
              c.attr('opacity', '0.8');
              i.attr('opacity', '0.6');
            })
            .click(function() {
              // Handle filtering of Bills list and display
              if (typeof bL != 'undefined') {
                bL.filterCategory(this.data('name').replace('\n', ''));
                $('#bubble-chooser').slideUp('fast');
                $('#category-details').slideDown('fast');
              }
            });
        
        }
      })(bubbleChart, billList, circle, image, text);
      setIt();
    }
    
    // Position elements
    spreadVis(bubbleChart);
  };
  
  // Function to convert hex to rgb
  function hexToRGB(h, part) {
    h = (h.charAt(0) == '#') ? h.substring(1,7) : h;
    switch (part) {
      case 'R':
        return parseInt(h.substring(0, 2), 16);
        break;
        
      case 'G':
        return parseInt(h.substring(2, 4), 16);
        break;
        
      case 'B':
        return parseInt(h.substring(4, 6), 16);
        break;
    }
  };

  // Move the bubbles around.
  function spreadVis(paper) {
    paper.forEach(function(el) {
      // Position elements, pulling position from their data, and 
      // create animation
      if (el.type === 'circle') {
        var spread = Raphael.animation({
          'cx': el.data('spreadX'), 
          'cy': el.data('spreadY')
        }, 1000, 'backOut');
        el.animate(spread.delay(Math.random() * 1000));
        
      } 
      else if (el.type === 'text' || el.type === 'image') {
        var spread = Raphael.animation({
          'x': el.data('spreadX'), 
          'y': el.data('spreadY')
        }, 1000, 'backOut');
        el.animate(spread.delay(Math.random() * 1000));
      }
    });
  };
  
  // Wrapping text function
  function wrapText(text, textObject) {
    var maxWidth = 140;
    var words = text.split(' ');
    var tempText = '';
    
    // Opera does not like Raphaels bbox command so
    // we just bypass this
    /*
    if ($.browser.opera) {
      return textObject.attr('text', text);
    }
    */
    
    for (var i = 0; i < words.length; i++) {
      textObject.attr('text', tempText + ' ' + words[i]);
      if (textObject.getBBox(true).width > maxWidth) {
        tempText += '\n' + words[i];
      }
      else {
        tempText += ' ' + words[i];
      }
    }
    return textObject.attr('text', tempText.substring(1));
  };
  
  // Mark as loading
  $('<span class="loading-temp">Loading�</span>').hide().prependTo($('#application-nav').parent()).fadeIn();
  
  // Process bill data and handle application.  JSONP callback
  // $.getJSON('data/bills.json', function(data) {
  billsProcess = function(data) {
    // Get categories
    var i;
    var categories = {};
    for (i in data) {
      var c;
      if (_.isArray(data[i].categories)) {
        for (c in data[i].categories) {
          categories[data[i].categories[c]] = categories[data[i].categories[c]] || [];
          categories[data[i].categories[c]].push(i);
        }
      }
    }

    // Create bills collection
    var bills = new Bills();
    for (var i in data) {
      data[i].bill = i;
      bills.add(new Bill(data[i]));
    }
    
    // Handle list of bills
    var billList = new BillsListView({ el: app.options.el, collection: bills });
    
    // Done loading
    $('.loading-temp').fadeOut();
    $('#application-nav, #tab-container').show();
    
    // Create bubble visualization
    visCategories(categories, billList);

    // Navigation and interface
    $('.all-categories').on('click', app.options.el, function(e) {
      e.preventDefault();
      if ($('.by-category').hasClass('tab-active')) {
        $('#bubble-chooser').slideDown('fast');
      }
      else {
        $('#address-chooser').slideDown('fast');
      }
      $('#category-details').slideUp('fast');
    });
    
    // Tabs
    $('.by-category').click(function(e) {
      e.preventDefault();
      if (!$('.by-category').hasClass('tab-active')) {
        $('#address-chooser').fadeOut('fast');
        $('#application-nav li, #application-nav a').toggleClass('tab-active');
      }
      $('#bubble-chooser').fadeIn('fast');
      $('#category-details').hide();
    });
    $('.by-address').click(function(e) {
      e.preventDefault();
      if (!$('.by-address').hasClass('tab-active')) {
        $('#bubble-chooser').fadeOut('fast');
        $('#application-nav li, #application-nav a').toggleClass('tab-active');
      }
      $('#address-chooser').fadeIn('fast');
      $('#category-details').hide();
    });
    
    // Address input form
    var inputText = 'Enter your address';
    $('#address-chooser-address').val(inputText).addClass('showing-label')
    .focus(function() {
      if ($(this).val() == inputText) {
        $(this).val('').removeClass('showing-label');
      }
    })
    .blur(function() {
      if ($(this).val() == '' || $(this).val() == inputText) {
        $(this).val(inputText).addClass('showing-label');
      }
    });
  };
  
  app.start = function(data) {
    app.getData('data/bills').done(function(data) {
      billsProcess(data);
    });
  };
})(mpApp['minnpost-legislature-roundup-2013'], jQuery);
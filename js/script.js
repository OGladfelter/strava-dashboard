function openTab(evt, tabID) {
    // Declare all variables
    var i, tabcontent, tablinks;
  
    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
  
    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
  
    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabID).style.display = "block";
    evt.currentTarget.className += " active";

    // if (tabID == 'heatmapTab') {
    //     if (typeof map !== 'undefined') {
    //         return;
    //     }
    //     else {
    //         drawHeatmap();
    //     }
    // }
}

const getDatesBetween = (startDate, endDate) => {
    const dates = [];
    const currentDate = startDate;
    while (currentDate < endDate) {
        dates.push({'date': new Date(currentDate), 'miles':0});
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
};

// function fillMissingDates(data) {

//     // for every day without an activity, create an object to fill in the missing data
//     var missingDates = getDatesBetween(data[0].date, data[data.length-1].date);
//     const dates = [...new Set( data.map(obj => obj.date.getTime())) ];
//     missingDates = missingDates.filter(d => !dates.includes(d.date.getTime()));
//     var completeData = data.concat(missingDates);

//     // sort chronologically
//     completeData.sort(function(a,b){
//         return a.date - b.date;
//     });
//     return completeData;
// }

function fillMissingMonths(data) {
    var timestamp = Date.parse(data[0].key); // convert the earliest key, which is a month in string form, to epoch timestamp
    var date = new Date(timestamp); // convert epoch timestamp into date object
    var missingMonths = d3.timeMonth.every(1).range(new Date(date.getFullYear(), date.getMonth(), date.getDay()), new Date());
    var completeData = [];
    missingMonths.forEach(m => {
        var match = data.filter(d => d.key == m.toString());
        let value = 0;
        if (match.length == 1) {
            value = match[0].value;
        }
        completeData.push({key:m.toString(), value:value})
    });
    return completeData;
}

function groupActivities(data) {

    data.forEach(function(d, i){
        d.mileage = +d.mileage;
        d.month = new Date(d.date.getFullYear(), d.date.getMonth(), 1);
    });
    
    return d3.nest().key(function(d){return d.month;}).rollup(function(activities){
        return d3.sum(activities, function(d) {return (d.miles)});
    }).entries(data);
}

function callTooltip(d, text) {
    tooltip
        .style("visibility", "visible")
        .html(text)
        .transition().duration(250)
        .style("left", function() {
            // if mouse is on left 80% of screen, show tooltip to right of cursor
            if (d3.event.pageX / window.innerWidth < .8){
                return d3.event.pageX + 10 + "px"  
            }
            else { // show tooltip to left of cursor
                return d3.event.pageX - document.querySelector('.tooltip').offsetWidth - 10 + "px" 
            }
        }) 
        .style("top", d3.event.pageY + 10 + "px"); 
}

function mileagePlot(activitiesData) {

    if (screen.width < 600) { // mobile
        var margin = {top: 20, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.left - margin.right;
        var width = window.innerWidth * .95 - margin.top - margin.bottom;
        var numTicks = 3;
    }
    else { // larger device
        var margin = {top: 30, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.top - margin.bottom;
        var width = window.innerWidth * .9 - margin.left - margin.right;
        var numTicks = 8;
    }
    var padding = 10;

    var svg = d3.select('#mileageLineplot').append("svg")
        .attr("width",  width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // data prep done already for us
    var datasets = JSON.parse(JSON.stringify(activitiesData));

    let maxMileage = 0; // needed for scale
    activityTypes.forEach(t => {
        datasets[t].forEach(d => {
            d.key = new Date(d.key);
        });
        maxMileage = Math.max(maxMileage, d3.max(datasets[t], d => d.value));
    });
    var allData = Object.values(datasets).flat();
    
    // set the ranges - based on dataset with highest mileage, dataset with most months in it
    var dataXrange = d3.extent(allData, function(d) { return d.key; });
    var x = d3.scaleTime().range([padding, width - padding]).domain(dataXrange);
    var y = d3.scaleLinear().range([height - padding, padding]).domain([0, maxMileage]);

    // add X axis
    var xAxis = d3.axisBottom(x).ticks(numTicks).tickFormat(d3.timeFormat("%b '%y")).tickSizeOuter(0);
    svg.append("g")
            .attr("class", "axis")
            .attr("id", "x_axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

    //  Add the Y Axis
    svg.append("g")
        .attr("class", "axis")
        .attr("id", "y_axis")
        .call(d3.axisLeft(y)
        .tickSizeOuter(0));

    // y-axis label
    svg.append("text")
      .attr("y", 5)
      .attr("x", 10)
      .attr("dy", "1em")
      .style("text-anchor", "start")
      .style("fill", "#222")
      .attr("class", "yAxisLabel")
      .text("Mileage"); 

    // compute line function
    var mileageLine = d3.line()
        .x(function(d) { return x(d.key); })
        .y(function(d) { return y(d.value);  })
        .curve(d3.curveCatmullRom);
    
    var c = ["ffab00", "blue", "cyan", "#8C9B4D", "red", "purple", "#CB91FE", "#165539", "#F72E97", "#B692E7", "black", "silver"];
    var colors = {};

    // draw mileage lines
    activityTypes.forEach((t, i) => {
        colors[t] = c[i];
        svg.append("path")
            .data([datasets[t]]) 
            .attr("class", "mileage_line")  
            .style("stroke", c[i])
            .attr("d", mileageLine)
            .attr("id", t + "mileage_line");
    });

    // draw dots for tooltip feature
    svg.selectAll(".dot")
        .data(allData)
        .enter()
        .append("circle") 
        .style("fill", function(d) {return colors[d.type]}) 
        .attr("class", function(d) {return d.type + " dot"}) 
        .style("display", function(d) { return d.value == 0 ? 'none' : 'block'})
        .attr("cx", function(d) {return x(d.key)})
        .attr("cy", function(d) {return y(d.value)})
        .on("mouseover", function(d) { callTooltip(d, d.type + "<br>" + new Intl.DateTimeFormat('en-US', { month: 'short'}).format(d.key) + " " + d.key.getFullYear() + "<br>" + d.value.toFixed(1) + " miles") })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
        });  
}

function updateMileagePlot(activitiesData) {

    var datasets = JSON.parse(JSON.stringify(activitiesData));

    if (screen.width < 600) { // mobile
        var margin = {top: 20, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.left - margin.right;
        var width = window.innerWidth * .95 - margin.top - margin.bottom;
        var numTicks = 3;
    }
    else { // larger device
        var margin = {top: 30, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.top - margin.bottom;
        var width = window.innerWidth * .9 - margin.left - margin.right;
        var numTicks = 8;
    }
    var padding = 10;

    ////////////// the viz ///////////////
    
    let maxMileage = 0; // needed for scale
    activityTypes.forEach(t => {
        datasets[t].forEach(d => {
            d.key = new Date(d.key);
        });
        maxMileage = Math.max(maxMileage, d3.max(datasets[t], d => d.value));
    });
    var allData = Object.values(datasets).flat();

    // set the ranges - based on dataset with highest mileage, dataset with most months in it
    var dataXrange = d3.extent(allData, function(d) { return d.key; });
    var x = d3.scaleTime().range([padding, width - padding]).domain(dataXrange);
    var y = d3.scaleLinear().range([height - padding, padding]).domain([0, maxMileage]);

    // add X axis
    var xAxis = d3.axisBottom(x).ticks(numTicks).tickFormat(d3.timeFormat("%b '%y")).tickSizeOuter(0);
    //d3.select('#mileageLineplot').select("#x_axis").call(xAxis);
    d3.select('#mileageLineplot').select("#y_axis").call(d3.axisLeft(y));

   // compute line function
   var mileageLine = d3.line()
    .x(function(d) { return x(d.key); })
    .y(function(d) { return y(d.value);  })
    .curve(d3.curveCatmullRom);

   d3.select('#mileageLineplot').selectAll(".mileage_line").style("visibility", "hidden");
   d3.select('#mileageLineplot').select("svg").selectAll("circle").style("visibility", "hidden");

    // update mileage lines
    activityTypes.forEach((t) => {
        d3.select("#" + t + "mileage_line")
            .style("visibility", "visible")
            // .data([datasets[t]]) 
            // .transition()
            // .duration(2000)
            // .attr("d", mileageLine);

        d3.selectAll("." + t)
            .style("visibility", "visible")
    });
}

function drawBeeswarm(activitiesData) {

    const data = [...activitiesData].map(i => ({ ...i}));

    if (screen.width < 600) { // mobile
        var margin = {top: 20, right: 50, bottom: 60, left: 50};
        var height = window.innerHeight * .8 - margin.left - margin.right;
        var width = window.innerWidth * .95 - margin.top - margin.bottom;
        var numTicks = 3;
    }
    else { // larger device
        var margin = {top: 30, right: 100, bottom: 70, left: 50};
        var height = window.innerHeight * .5 - margin.top - margin.bottom;
        var width = window.innerWidth * .8 - margin.left - margin.right;
        var numTicks = 8;
    }

    ////////////// the viz ///////////////
    var svg = d3.select('#beeswarm').append("svg")
        .attr("width",  width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleLinear()
        .rangeRound([0, width]);

    var g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .attr("id", "beeswarm-g");

    x.domain(d3.extent(data, function(d) { return d.miles; }));

    var simulation = d3.forceSimulation(data)
        .force("x", d3.forceX(function(d) { return x(d.miles); }).strength(5))
        .force("y", d3.forceY(height / 2))
        .force("collide", d3.forceCollide(7))
        .stop();

    for (var i = 0; i < 120; ++i) simulation.tick();

    g.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).ticks(numTicks).tickSizeOuter(0).tickFormat(function (d) { if (Math.floor(d) != d) { return; } else { return d } } ));

    var cell = g.append("g")
        .attr("class", "cells")
        .selectAll("g").data(d3.voronoi()
            .extent([[-margin.left, -margin.top], [width + margin.right, height + margin.top]])
            .x(function(d) { return d.x; })
            .y(function(d) { return d.y; })
        .polygons(data)).enter().append("g");

    cell.append("circle")
        .attr("class", "bee")
        .attr("cx", function(d) { if (d) { return d.data.x; } })
        .attr("cy", function(d) { if (d) { return d.data.y; } })
        .style("display", function(d) { if (!d) { return 'none' } })
        .on("mouseover", function(d) { 
            d3.select(this).raise(); 
            callTooltip(d, d.data.name + "<br><hr>" + d.data.start_date_local.split("T")[0] + "<br>" + d.data.miles.toFixed(1) + " miles");
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
        })
        .on("click", function(d) { 
            var url = "https://www.strava.com/activities/" + d.data.id;
            window.open(url, '_blank').focus();
        });

    cell.append("path").attr("d", function(d) { if (d) { return "M" + d.join("L") + "Z"; }});

    // text label for the x axis
    svg.append("text")             
    .attr("transform", "translate(" + ((width - margin.left + margin.right)) + " ," + (height + margin.top - 10) + ")")
    .style("text-anchor", "end")
    .text("Miles");
}

function updateBeeswarm(activitiesData) {

    const data = [...activitiesData].map(i => ({ ...i}));

    if (screen.width < 600) { // mobile
        var margin = {top: 20, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.left - margin.right;
        var width = window.innerWidth * .95 - margin.top - margin.bottom;
        var numTicks = 3;
    }
    else { // larger device
        var margin = {top: 30, right: 100, bottom: 50, left: 50};
        var height = window.innerHeight * .5 - margin.top - margin.bottom;
        var width = window.innerWidth * .8 - margin.left - margin.right;
        var numTicks = 8;
    }

    var x = d3.scaleLinear()
        .rangeRound([0, width])
        .domain(d3.extent(data, function(d) { return d.miles; }));

    var simulation = d3.forceSimulation(data)
        .force("x", d3.forceX(function(d) { return x(d.miles); }).strength(5))
        .force("y", d3.forceY(height / 2))
        .force("collide", d3.forceCollide(7))
        .stop();

    for (var i = 0; i < 120; ++i) simulation.tick();

    d3.select("#beeswarm").select(".axis--x").call(d3.axisBottom(x).tickFormat(function (d) { if (Math.floor(d) != d) { return; } else { return d } } ));

    d3.select("#beeswarm").select(".cells").remove();

    var g = d3.select("#beeswarm").select("#beeswarm-g");

    var cell = g.append("g")
        .attr("class", "cells")
        .selectAll("g").data(d3.voronoi()
            .extent([[-margin.left, -margin.top], [width + margin.right, height + margin.top]])
            .x(function(d) { return d.x; })
            .y(function(d) { return d.y; })
        .polygons(data)).enter().append("g");

    cell.append("circle")
        .attr("class", "bee")
        .attr("cx", function(d) { if(d) { return d.data.x; } })
        .attr("cy", function(d) { if(d) { return d.data.y; }  })
        .style("display", function(d) { if (!d) { return 'none' } })
        .on("mouseover", function(d) { 
            d3.select(this).raise(); 
            callTooltip(d, d.data.name + "<br><hr>" + d.data.start_date_local.split("T")[0] + "<br>" + d.data.miles.toFixed(1) + " miles");
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
        })
        .on("click", function(d) { 
            var url = "https://www.strava.com/activities/" + d.data.id;
            window.open(url, '_blank').focus();
        });

    cell.append("path").attr("d", function(d) { if (d) { return "M" + d.join("L") + "Z"; }});
}

function drawGoalplot(activitiesData) {

    const data = [...activitiesData].map(i => ({ ...i}));

    const annual_mileage_goal = document.getElementById("slider").value; // how many miles I want to run in this year

    if (screen.width < 600) { // mobile
        var margin = {top: 20, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.left - margin.right;
        var width = window.innerWidth * .95 - margin.top - margin.bottom;
        var numTicks = 3;
    }
    else { // larger device
        var margin = {top: 30, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.top - margin.bottom;
        var width = document.getElementById("goalplot").offsetWidth * .9 - margin.left - margin.right;
        var numTicks = 8;
    }

    //////////////////////////// data prep /////////////////////////

    if (data[data.length - 1].date.setHours(0, 0, 0, 0) != new Date().setHours(0, 0, 0, 0)) {
        // most recent activity was previous date. Add an activity with 0 distance
        data.push({
            date: new Date(),
            miles: 0,
        });
    }

    // compute needed vars
    var total_miles = 0;
    data.forEach(function(d){

        // for given date, calc what day it is in the year. 1st day? 50th day? etc.
        var start = new Date(d.date.getFullYear(), 0, 0);
        var diff = d.date - start;
        var oneDay = 1000 * 60 * 60 * 24;
        day_of_year = Math.floor(diff / oneDay);
        d.day_of_year = day_of_year;

        // compute how many miles have been run cumulatively, save to each row
        total_miles = total_miles + d.miles;
        d.mileage = total_miles;

        // calc pace column. This is how many miles I should have run to be "on track"
        d.pace = (annual_mileage_goal / 365) * day_of_year;
    });

    // control how many labels are shown: lower number = more labels. Ex: 2 = label every other day, 10 = every other 10 days
    // label more on larger screen, less on small screen
    if (screen.width < 600){
        var label_freq = Math.floor(data.length / 7) + 1;
    } else {
        var label_freq = Math.floor(data.length / 14) + 1;
    }

    ////////////// the viz ///////////////
    svg = d3.select('#goalplot').append("svg")
    .attr("width",  width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // get max values of mileage and pace columns.
    // if I'm ahead of pace, my mileage will exceed pace. And vice versa. 
    // regardless, the higher value should cap the y-axis
    const maxMileage = d3.max(data, d => d.mileage);
    const maxPace = d3.max(data, d => d.pace);

    var jan01 = new Date(new Date().getFullYear(), 0, 1);

    // set the ranges
    var x = d3.scaleTime().range([0, width]).domain([jan01, new Date()]);
    var y = d3.scaleLinear().range([height, 0]).domain([0,d3.max([maxMileage, maxPace])]);

    // add axes
    var xAxis = d3.axisBottom(x).ticks(numTicks).tickSizeOuter(0).tickFormat(d3.timeFormat("%b %d"));

    svg.append("g")
            .attr("class", "axis")
            .attr("id", "x_axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

    //  Add the Y Axis
    yAxis = svg.append("g").attr("class", "axis").attr("id", "y_axis").call(d3.axisLeft(y).tickSizeOuter(0));

    svg.append("text")
      //.attr("transform", "rotate(-90)")
      .attr("y", 5)
      .attr("x", 10)
      .attr("dy", "1em")
      .style("text-anchor", "start")
      .style("fill", "#222")
      .attr("class", "yAxisLabel")
      .text("Cumulative Mileage"); 

    // compute line function
    var mileageLine = d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.mileage);  })
        .curve(d3.curveStepAfter);

    // draw mileage line
    svg.append("path")
        .data([data]) 
        .attr("class", "mileage_line")  
        .attr("id", "mileage_line")
        .attr("d", mileageLine); 

    // draw straight line from first pace and date to final pace and date
    svg.append('line')
        .attr("class", "pace_line")
        .attr("id", "pace_line")
        .attr("x1", x(data[0].date))
        .attr("y1", y(data[0].pace))
        .attr("x2", x(data[data.length-1].date))
        .attr("y2", y(data[data.length-1].pace));

    // draw dots
    svg.selectAll(".dot")
        .data(data)
        .enter()
        .append("circle") 
        .attr("class", "dot") 
        .attr("cx", function(d) {return x(d.date)})
        .attr("cy", function(d) {return y(d.mileage)})
        .style("display", function(d) { if (d.miles == 0) { return 'none' } else { return 'block'}})
        .on("mouseover", pointMouseover)
        .on("mouseout", pointMouseout);  

    // draw labels
    svg.selectAll(".label")
        .data(data)
        .enter()
        .append("text") // Uses the enter().append() method
        .attr("class", "label") // Assign a class for styling
        .attr("x", function(d) { return x(d.date) })
        .attr("y", function(d) { return y(d.mileage) })
        .attr("dy", "-20")
        .text(function(d, i) {
            if (i > 0){
                // label every other (label_freq) days
                if (i % label_freq == 0){
                    return d.mileage.toFixed(0);    
                } 
                else{ return "" }
            }
            else{
                // don't label Jan 1st
                return "";
            }
        })
        .style("display", function(d) { if (d.miles == 0) { return 'none' } else { return 'block'}})
        .call(getTextBox);
    
    // draw rectangle on top of text label; called on every text label;
    function getTextBox(selection) {

        d3.selectAll("#labelBackground").remove();

        // for each element in the selection...
        selection.each(function() { 
            
            var bbox = this.getBBox(); // get the bounding box

            svg.append("rect")
            .attr("id", "labelBackground")
            .attr("x", bbox.x)
            .attr("y", bbox.y)
            .attr("width", bbox.width)
            .attr("height", Math.max(0, bbox.height - 5)) // returns a slightly shorter-than text box (or 0 if there isn't a label)
            .style("fill", "whitesmoke");
        });

        // rect is drawn on top of label. Pull label above rect.
        selection.raise();

        // annotations node too
        d3.select(".annotation").raise();
    };

    // adding intersection lines
    svg.append("line")
        .attr("class","hoverLineHorizontal")
        .attr("x1", x(0))
        .attr("x2", x(0))
        .attr("y1", y(0))
        .attr("y2", y(0))
        .style("visibility","hidden");
    svg.append("line")
        .attr("class","hoverLineVerical")
        .attr("x1", x(0))
        .attr("x2", x(0))
        .attr("y1", y(0))
        .attr("y2", y(0))
        .attr("visibility","hidden");

    ///////////////////////// code for annotations box ///////////////////////////////////////////////////////

    // annotations box can be dragged
    function dragged(event, d) {d3.select(this).attr("transform", "translate(" + (d3.event.x) + "," + (d3.event.y) + ")");}

    // measure diff between actual mileage and pace mileage
    var paceEval = Math.abs(data[data.length-1].mileage - data[data.length-1].pace);
    var aheadBehind = (data[data.length-1].mileage > data[data.length-1].pace) ? "ahead of" : "behind";

    // measure how many miles I'm on pace to run by year's end
    // # of miles so far / # of days so far * 365
    var onTrackFor = data[data.length-1].mileage / data[data.length-1].day_of_year * 365;
    
    // create annotations node
    annotations = svg
        .append("g")
        .attr("class", "annotation")
        .call(d3.drag().on("drag", dragged));
    
    // add rectangle
    annotations.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        // we will determine width and height programatically after adding text
       
    // "ZZ miles this year" text
    annotations.append("text")
        .attr("id", "milesThisYearText")
        .attr("x", 10)
        .attr("y", 10)
        .style("dominant-baseline", "hanging")
        .html(d3.format(",")(data[data.length-1].mileage.toFixed(0)) + ' miles this year');
    
    // "YY miles ahead/behind pace" text
    annotations.append("text")
        .attr("id", "paceEvalText")
        .attr("x", 10)
        .attr("y", 32)
        .style("dominant-baseline", "hanging")
        .html(paceEval.toFixed(0) + " miles " + aheadBehind + " goal pace");
    
    // "On pace to run Y,YYY miles" text
    annotations.append("text")
        .attr("id", "onPaceForText")
        .attr("x", 10)
        .attr("y", 54)
        .style("dominant-baseline", "hanging")
        .html("On track for " + d3.format(",")(onTrackFor.toFixed()) + " miles this year");

    // use bounding boxes on first and last text lines to determine rectangle dimensions
    var bbox1 = document.getElementById("milesThisYearText").getBBox();
    var bbox2 = document.getElementById("onPaceForText").getBBox();

    var annotationsWidth = bbox2.width + 25;
    var annotationsHeight = bbox2.y + bbox2.height - bbox1.y + 15;

    annotations.select("rect").attr("width", annotationsWidth).attr("height", annotationsHeight);

    // move annotations box to bottom right corner of graph (with some breathing room)
    annotations.attr("transform", "translate(" + 10 + "," + 40 + ")");

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    //////////////////////////// slider to change mileage goal /////////////////////////////////////////////////////////

    var slider = document.getElementById("slider");
    slider.value = annual_mileage_goal; // sets slider value to match parameter set at top of this file
    var sliderLabel = document.getElementById("sliderLabel");

    const min = slider.min
    const max = slider.max
    const value = slider.value

    // the bar up to slider value is orange, and gray on other side
    slider.style.background = `linear-gradient(to right, #ffab00, #ffab00 ${(value-min)/(max-min)*100}%, #c6c6c6 ${(value-min)/(max-min)*100}%, #c6c6c6 100%)`

    // slider change function
    slider.oninput = function(){

        // everything up to cursor is orange, and gray on other side
        this.style.background = `linear-gradient(to right, #ffab00, #ffab00 ${(this.value-this.min)/(this.max-this.min)*100}%, #c6c6c6 ${(this.value-this.min)/(this.max-this.min)*100}%, #c6c6c6 100%)`

        // update slider label
        sliderLabel.innerHTML = d3.format(",")(slider.value);

        // update line 
        updateGoal(slider.value);
    };

    function updateGoal(newGoal){
        
        // recompute and overwrite pace column
        data.forEach(function(d, i){
            d.pace = (newGoal / 365) * (d.day_of_year);
        });

        var newGoalPaceToday = data[data.length-1].pace;

        // update y axis
        y.domain([0,d3.max([data[data.length-1].mileage, newGoalPaceToday])]);
        yAxis.call(d3.axisLeft(y).tickSizeOuter(0));

        // move pace line
        document.getElementById("pace_line").y2.baseVal.value = y(newGoalPaceToday);

        // update mileage line
        mileageLine.x(function(d) { return x(d.date); }).y(function(d) { return y(d.mileage); });
        d3.select("#mileage_line").transition().attr("d", mileageLine); 

        // move labels to stay with line
        svg.selectAll(".label").attr("y", function(d) { return y(d.mileage) }).call(getTextBox);

        // move dots to stay with line
        svg.selectAll(".dot").transition().attr("cy", function(d) {return y(d.mileage)});

        // update pace eval text
        paceEval = Math.abs(data[data.length-1].mileage - newGoalPaceToday);
        aheadBehind = (data[data.length-1].mileage > newGoalPaceToday) ? "ahead of" : "behind";
        d3.select("#paceEvalText").text(paceEval.toFixed(0) + " miles " + aheadBehind + " goal pace");
    }
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    //////////////////// tool tip and mouse over code ///////////////////////////////////////////////////////////

    // use this in the tooltip
    dateToString = d3.timeFormat("%b %d");

    function pointMouseover(d){

        // info for tooltip
        var paceEval = Math.abs(d.mileage - d.pace).toFixed(0);
        var aheadBehind = (d.mileage > d.pace) ? " ahead of" : " behind";

        // move tooltip
        tooltip
            .style("visibility", "visible")
            .html("<b>" + dateToString(d.date) + "</b>: " + d.miles.toFixed(1) + " Miles<br>Year to Date: " + d.mileage.toFixed(0) + "<br>" + paceEval +  aheadBehind + " pace")
            .transition().duration(250)
            .style("left", function(){

                // if mouse is on left 80% of screen, show tooltip to right of cursor
                if (d3.event.pageX / window.innerWidth < .8){
                    return d3.event.pageX + 10 + "px"  
                }
                else{ // show tooltip to left of cursor
                    return d3.event.pageX - document.querySelector('.tooltip').offsetWidth - 10 + "px" 
                }
            }) 
            .style("top", d3.event.pageY + 10 + "px"); 

        // update intersection lines
        d3.select(".hoverLineHorizontal")
        .attr("x1", x(d3.select(this).datum().date))
        .attr("x2", x(d3.select(this).datum().date))
        .attr("y1", y(0))
        .attr("y2", y(d3.select(this).datum().mileage))
        .style("visibility","visible");

        d3.select(".hoverLineVerical")
        .attr("x1", 0)
        .attr("x2", x(d3.select(this).datum().date))
        .attr("y1", y(d3.select(this).datum().mileage))
        .attr("y2", y(d3.select(this).datum().mileage))
        .style("visibility","visible");
    }

    function pointMouseout(){
        tooltip.style("visibility", "hidden");
        d3.select(".hoverLineHorizontal").style("visibility","hidden");
        d3.select(".hoverLineVerical").style("visibility","hidden");
    }
    
    document.getElementById("sliderDiv").style.visibility = "visible";
}

function updateGoalplot(activitiesData) {
        
    const data = [...activitiesData].map(i => ({ ...i}));

    const annual_mileage_goal = document.getElementById("slider").value; // how many miles I want to run in this year

    if (screen.width < 600) { // mobile
        var margin = {top: 20, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.left - margin.right;
        var width = window.innerWidth * .95 - margin.top - margin.bottom;
        var numTicks = 3;
    }
    else { // larger device
        var margin = {top: 30, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.top - margin.bottom;
        var width = document.getElementById("goalplot").offsetWidth * .9 - margin.left - margin.right;
        var numTicks = 8;
    }

    if (data[data.length - 1].date.setHours(0, 0, 0, 0) != new Date().setHours(0, 0, 0, 0)) {
        // most recent activity was previous date. Add an activity with 0 distance
        data.push({
            date: new Date(),
            miles: 0,
        });
    }

    // compute needed vars
    var total_miles = 0;
    data.forEach(function(d){

        // for given date, calc what day it is in the year. 1st day? 50th day? etc.
        var start = new Date(d.date.getFullYear(), 0, 0);
        var diff = d.date - start;
        var oneDay = 1000 * 60 * 60 * 24;
        day_of_year = Math.floor(diff / oneDay);
        d.day_of_year = day_of_year;

        // compute how many miles have been run cumulatively, save to each row
        total_miles = total_miles + d.miles;
        d.mileage = total_miles;

        // calc pace column. This is how many miles I should have run to be "on track"
        d.pace = (annual_mileage_goal / 365) * day_of_year;
    });

    // control how many labels are shown: lower number = more labels. Ex: 2 = label every other day, 10 = every other 10 days
    // label more on larger screen, less on small screen
    if (screen.width < 600){
        var label_freq = Math.floor(data.length / 7) + 1;
    } else {
        var label_freq = Math.floor(data.length / 14) + 1;
    }

    var jan01 = new Date(new Date().getFullYear(), 0, 1);

    // update scale functions
    var x = d3.scaleTime().range([0, width]).domain([jan01, new Date()]);
    var y = d3.scaleLinear().range([height, 0]).domain([0,d3.max([data[data.length-1].mileage, data[data.length-1].pace])]);

    // update axes
    var xAxis = d3.axisBottom(x).ticks(numTicks).tickSizeOuter(0).tickFormat(d3.timeFormat("%b %d"));
    d3.select("#goalplot").select("#x_axis").call(xAxis);
    d3.select("#goalplot").select("#y_axis").call(d3.axisLeft(y).tickSizeOuter(0));
    
    // compute line function
    var mileageLine = d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.mileage);  })
        .curve(d3.curveStepAfter);

    // move distance line
    d3.select("#goalplot").select("#mileage_line").data([data]).transition().duration(2000).attr("d", mileageLine);

    // move pace line
    document.getElementById("pace_line").y2.baseVal.value = y(data[data.length-1].pace);

    // for dot hover interactivity
    function pointMouseover(d){

        // info for tooltip
        var paceEval = Math.abs(d.mileage - d.pace).toFixed(0);
        var aheadBehind = (d.mileage > d.pace) ? " ahead of" : " behind";

        // move tooltip
        tooltip
            .style("visibility", "visible")
            .html("<b>" + dateToString(d.date) + "</b>: " + d.miles.toFixed(1) + " Miles<br>Year to Date: " + d.mileage.toFixed(0) + "<br>" + paceEval +  aheadBehind + " pace")
            .transition().duration(250)
            .style("left", function(){

                // if mouse is on left 80% of screen, show tooltip to right of cursor
                if (d3.event.pageX / window.innerWidth < .8){
                    return d3.event.pageX + 10 + "px"  
                }
                else{ // show tooltip to left of cursor
                    return d3.event.pageX - document.querySelector('.tooltip').offsetWidth - 10 + "px" 
                }
            }) 
            .style("top", d3.event.pageY + 10 + "px"); 

        // update intersection lines
        d3.select(".hoverLineHorizontal")
        .attr("x1", x(d3.select(this).datum().date))
        .attr("x2", x(d3.select(this).datum().date))
        .attr("y1", y(0))
        .attr("y2", y(d3.select(this).datum().mileage))
        .style("visibility","visible");

        d3.select(".hoverLineVerical")
        .attr("x1", 0)
        .attr("x2", x(d3.select(this).datum().date))
        .attr("y1", y(d3.select(this).datum().mileage))
        .attr("y2", y(d3.select(this).datum().mileage))
        .style("visibility","visible");
    }

    function pointMouseout(){
    
        // hide tooltip
        tooltip.style("visibility", "hidden");

        // hide intersection lines
        d3.select(".hoverLineHorizontal").style("visibility","hidden");
        d3.select(".hoverLineVerical").style("visibility","hidden");
    }

    svg.selectAll(".dot").remove();
    svg.selectAll(".label").remove();
    
    // draw dots
    svg.selectAll(".dot")
        .data(data)
        .enter()
        .append("circle") 
        .attr("class", "dot") 
        .attr("cx", function(d) {return x(d.date)})
        .attr("cy", function(d) {return y(d.mileage)})
        .style("display", function(d) { if (d.miles == 0) { return 'none' } else { return 'block'}})
        .on("mouseover", pointMouseover)
        .on("mouseout", pointMouseout);  

    // draw labels
    svg.selectAll(".label")
        .data(data)
        .enter()
        .append("text") // Uses the enter().append() method
        .attr("class", "label") // Assign a class for styling
        .attr("x", function(d) { return x(d.date) })
        .attr("y", function(d) { return y(d.mileage) })
        .attr("dy", "-20")
        .text(function(d, i) {
            if (i > 0){
                // label every other (label_freq) days
                if (i % label_freq == 0){
                    return d.mileage.toFixed(0);    
                } 
                else{ return "" }
            }
            else{
                // don't label Jan 1st
                return "";
            }
        })
        .style("display", function(d) { if (d.miles == 0) { return 'none' } else { return 'block'}})
        .call(getTextBox);

    function getTextBox(selection) {

        d3.selectAll("#labelBackground").remove();

        selection.each(function() { 
            
            bbox = this.getBBox(); 

            svg.append("rect")
            .attr("id", "labelBackground")
            .attr("x", bbox.x)
            .attr("y", bbox.y)
            .attr("width", bbox.width)
            .attr("height", Math.max(0, bbox.height - 5)) // returns a slightly shorter-than text box (or 0 if there isn't a label)
            .style("fill", "whitesmoke");
        });

        selection.raise();

        // annotations node too
        d3.select(".annotation").raise();
    };

    ///////////////////////// code for text annotations ///////////////////////////////////////////////////////

    // measure diff between actual mileage and pace mileage
    var paceEval = Math.abs(data[data.length-1].mileage - data[data.length-1].pace);
    var aheadBehind = (data[data.length-1].mileage > data[data.length-1].pace) ? "ahead of" : "behind";

    // measure how many miles I'm on pace to run by year's end
    // # of miles so far / # of days so far * 365
    var onTrackFor = data[data.length-1].mileage / data[data.length-1].day_of_year * 365;

    // "ZZ miles this year"
    d3.select("#milesThisYearText").text(d3.format(",")(data[data.length-1].mileage.toFixed(0)) + ' miles this year'); 

    // "YY miles ahead/behind pace"
    d3.select("#paceEvalText").text(paceEval.toFixed(0) + " miles " + aheadBehind + " goal pace"); 

    // "On pace to run Y,YYY miles"
    d3.select("#onPaceForText").text("On track for " + d3.format(",")(onTrackFor.toFixed()) + " miles this year");

    ///////////////////////////////////////////////////////////////////////////////////////////////////

    // update slider function
    slider.oninput = function(){

        // everything up to cursor is orange, and gray on other side
        this.style.background = `linear-gradient(to right, #ffab00, #ffab00 ${(this.value-this.min)/(this.max-this.min)*100}%, #c6c6c6 ${(this.value-this.min)/(this.max-this.min)*100}%, #c6c6c6 100%)`
        
        // update slider label
        sliderLabel.innerHTML = d3.format(",")(slider.value);

        // update line 
        updateGoal(slider.value);
    };

    function updateGoal(newGoal){

        // recompute and overwrite pace column
        data.forEach(function(d, i){
            d.pace = (newGoal / 365) * d.day_of_year;
        });

        var newGoalPaceToday = data[data.length-1].pace;

        // update y axis
        y.domain([0,d3.max([data[data.length-1].mileage, newGoalPaceToday])]);
        yAxis.call(d3.axisLeft(y).tickSizeOuter(0));

        // move pace line
        document.getElementById("pace_line").y2.baseVal.value = y(newGoalPaceToday);

        // update mileage line
        mileageLine.y(function(d) { return y(d.mileage); });
        d3.select("#mileage_line").transition().attr("d", mileageLine); 

        // move labels to stay with line
        svg.selectAll(".label").attr("y", function(d) { return y(d.mileage) }).call(getTextBox);

        // move dots to stay with line
        svg.selectAll(".dot").transition().attr("cy", function(d) {return y(d.mileage)})

        // update pace eval text
        paceEval = Math.abs(data[data.length-1].mileage - newGoalPaceToday);
        aheadBehind = (data[data.length-1].mileage > newGoalPaceToday) ? "ahead of" : "behind";
        d3.select("#paceEvalText").text(paceEval.toFixed(0) + " miles " + aheadBehind + " goal pace");
    }
}

function gearPlot(activitiesData) {

    if (screen.width < 600) { // mobile
        var margin = {top: 20, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.left - margin.right;
        var width = window.innerWidth * .95 - margin.top - margin.bottom;
        var numTicks = 3;
    }
    else { // larger device
        var margin = {top: 30, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.top - margin.bottom;
        var width = window.innerWidth * .9 - margin.left - margin.right;
        var numTicks = 8;
    }
    var padding = 25;

    var svg = d3.select('#gearPlot').append("svg")
        .attr("width",  width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // data prep done already for us
    const data = [...activitiesData].map(i => ({ ...i}));

    // set the ranges - x axis is date, y axis is discrete
    var dateRange = d3.extent(data, function(d) { return d.date; });
    var gear_ids = d3.map(data, function(d){return d.gear_id;});
    var x = d3.scaleTime().range([padding, width - padding]).domain(dateRange);
    var y = d3.scalePoint().range([height - padding, padding]).domain(gear_ids);

    var nodes = data.map(function(node, index) {
        return {
          x: x(node.date),
          y: y(node.gear_id),
          name: node.name,
          start_date_local: node.start_date_local,
          miles: node.miles,
          id: node.id
        };
      });

    // add X axis
    var xAxis = d3.axisBottom(x).ticks(numTicks).tickSizeOuter(0);
    svg.append("g")
            .attr("class", "axis")
            .attr("id", "x_axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

    //  Add the Y Axis
    svg.append("g")
        .attr("class", "axis")
        .attr("id", "y_axis")
        .call(d3.axisLeft(y)
        .tickSizeOuter(0));

    var simulation = d3.forceSimulation(nodes)
      .force("collide", d3.forceCollide().radius(2))
      .stop();
  
    for (var i = 0; i < 150; ++i) simulation.tick();

    // draw dots
    svg.selectAll(".gearDot")
        .data(nodes)
        .enter()
        .append("circle") 
        .attr("class", "gearDot")
        .attr("r", 5)
        .attr("cx", function(d) {return d.x})
        .attr("cy", function(d) {return d.y})
        .on("mouseover", function(d) { 
            d3.select(this).raise(); 
            callTooltip(d, d.name + "<br><hr>" + d.start_date_local.split("T")[0] + "<br>" + d.miles.toFixed(1) + " miles");
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
        })
        .on("click", function(d) { 
            var url = "https://www.strava.com/activities/" + d.id;
            window.open(url, '_blank').focus();
        });
}

function updateGearPlot(activitiesData) {

    if (screen.width < 600) { // mobile
        var margin = {top: 20, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.left - margin.right;
        var width = window.innerWidth * .95 - margin.top - margin.bottom;
        var numTicks = 3;
    }
    else { // larger device
        var margin = {top: 30, right: 50, bottom: 50, left: 50};
        var height = window.innerHeight * .8 - margin.top - margin.bottom;
        var width = window.innerWidth * .9 - margin.left - margin.right;
        var numTicks = 8;
    }
    var padding = 25;

    var svg = d3.select('#gearPlot').select("svg");

    const data = [...activitiesData].map(i => ({ ...i}));

    // set the ranges - x axis is date, y axis is discrete
    var dateRange = d3.extent(data, function(d) { return d.date; });
    var gear_ids = d3.map(data, function(d){return d.gear_id;});
    var x = d3.scaleTime().range([padding, width - padding]).domain(dateRange);
    var y = d3.scalePoint().range([height - padding, padding]).domain(gear_ids);

    var nodes = data.map(function(node, index) {
        return {
          x: x(node.date),
          y: y(node.gear_id),
          name: node.name,
          start_date_local: node.start_date_local,
          miles: node.miles,
          id: node.id
        };
      });

    // update X axis
    var xAxis = d3.axisBottom(x).ticks(numTicks).tickSizeOuter(0);
    svg.select("#x_axis").call(xAxis);

    // update Y axis
    svg.select("#y_axis").call(d3.axisLeft(y).tickSizeOuter(0));

    var simulation = d3.forceSimulation(nodes)
      .force("collide", d3.forceCollide().radius(2))
      .stop();
  
    for (var i = 0; i < 150; ++i) simulation.tick();

    // bind new data to exisiting circles
    var circles = svg.selectAll(".gearDot")
        .data(nodes);

    // enter
    circles.enter().append("circle")
        .merge(circles)
        .attr("class", "gearDot")
        .attr("r", 5)
        .attr("cx", function(d) {return d.x})
        .attr("cy", function(d) {return d.y})
        .on("mouseover", function(d) { 
            d3.select(this).raise(); 
            callTooltip(d, d.name + "<br><hr>" + d.start_date_local.split("T")[0] + "<br>" + d.miles.toFixed(1) + " miles");
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
        })
        .on("click", function(d) { 
            var url = "https://www.strava.com/activities/" + d.id;
            window.open(url, '_blank').focus();
        });

    // Exit
    circles.exit().remove();
}

function smallMultiplesSetUp(activitiesData) {
    data = activitiesData.filter(function(d) { return d.map.summary_polyline != null });

    data.forEach(d => {
        // returns an array of lat, lon pairs
        var path = polyline.decode(d.map.summary_polyline);

        const activityCoordinates = [];

        path.forEach(d => {
            activityCoordinates.push({lat: d[0], lng: d[1]})
        });

        var lineColor = 'black';
        // make activities starting in Chicago a different color
        // if (d.start_longitude > -87.815606 && d.start_longitude < -87.564981 && d.start_latitude > 41.783071 && 42.010512) {
        //     lineColor = 'blue';
        // }

        drawSmallMultiples(activityCoordinates, d.name, d.start_date, lineColor);
    });

    document.addEventListener("keyup", function(event) {
        if (event.keyCode === 13) { // 'enter' was pressed
        svgToCanvas(data.length);
        document.getElementById("downloader").style.display = 'block';
        }
    });
  }
  
function drawSmallMultiples(data, name, date, lineColor) {

    // set the dimensions and margins of the graph
    var size = 60;
    var m = 5;
    const margin = {top: m, right: m, bottom: m, left: m},
    width = size,
    height = size;

    // convert array of coordinates to geojson feature collection
    var features = data.map(function(d) {
        return {     
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [d.lng, d.lat]
        }
        }
    });
    var featureCollection = { type:"FeatureCollection", features:features }

    // because we're plotting 3D data (lat, long position on earth) to 2D space, we need a projection
    var projection = d3.geoMercator()
    .translate([width / 2,height / 2])
    .fitSize([width,height], featureCollection);

    // append the svg object to the body of the page
    const svg = d3.select("#smallMultiplesContainer")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .on("click", function(){
        console.log(name, date);
        })
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Draw the line
    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", lineColor)
        .attr("stroke-width", 1)
        .attr("d", d3.line()
            .x(function(d) { return projection([d.lng,d.lat])[0]; })
            .y(function(d) { return projection([d.lng,d.lat])[1] })
        );
}
  
// each activity takes up a space of about 55px (based on plot size of 60px plus 10px margin plus 20px padding)
// so the # of activities drawn in each row before moving to the next row should be dynamically set based on how many 
// activities the screen size can comfortably fit (screen width in px / 55px)
function svgToCanvas(activityCount, activitiesPerRow = Math.floor(window.innerWidth / (60 + 10 + 20))) {
    activitySize = 60 + 10 + 20;
    var svgs = document.getElementById('smallMultiplesTab').querySelectorAll('svg');
    svgs.forEach((svg, i) => {
        var svgString = new XMLSerializer().serializeToString(svg);
        var canvas = document.getElementById("canvas");
        var ctx = canvas.getContext("2d");
        ctx.canvas.width  = window.innerWidth;
        ctx.canvas.height = activityCount / activitiesPerRow * activitySize; // should be # of total activities / # of activities per row * img size
        var DOMURL = self.URL || self.webkitURL || self;
        var img = new Image();
        var svg = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
        var url = DOMURL.createObjectURL(svg);
        img.onload = function() {
            var png = canvas.toDataURL("image/png");
            ctx.drawImage(img, (i % activitiesPerRow) * activitySize, Math.floor(i / activitiesPerRow) * activitySize); // move to a subsequent row when current row hits X activities.
            document.querySelector('#smallMultiplesContainer').innerHTML = '<img src="'+png+'"/>';
            DOMURL.revokeObjectURL(png);    
        };
        img.src = url;
    });
};
  
function download() {
    canvas.toBlob(function (blob) {
        let link = document.createElement('a');
        link.download = "GPX_activities_in_small_multiples.png";
        link.href = URL.createObjectURL(blob);
        link.click();
    });
};
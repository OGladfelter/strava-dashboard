// world map code
mapTiles = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
        continuousWorld: false,
        noWrap: true
});

var map = new L.Map('heatmap', {
  'center': [40.655239, -73.972084],
  'zoom': 12,
  'maxZoom': 14, 
  'minZoom': 1,
  'layers': [mapTiles],
});
map.setMaxBounds([[-90,-180], [90,180]]);

// map.on('moveend', function() { 
//     console.log(map.getBounds());
// });
//////////

var zoomExtent = 13, speed = 4, startingColor = 'red', endingColor = '#0e005e';

// read and map data
function animateHeatmap(data, fastForward = 'N') {

    //data = data.filter(d => d.type == "Run");

    // turn off all dragging and zooming while the animation plays. Turn back on later.
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    $(".leaflet-control-zoom").css("opacity", 0.5).css("pointer-events", "none");
    map.options.minZoom = 12;
    map.options.maxZoom = 12;

    // filter out activities without a summary polyline
    data = data.filter(d => d.summary_polyline != "" && d.summary_polyline != undefined);

    // draw the activity lines onto the map
    data.forEach(d => {        
        // translate summary polyline into array of coordinates
        var coordinates = L.Polyline.fromEncoded(d.summary_polyline).getLatLngs();

        //console.log(coordinates);
        // don't add activities to map unless they're within the user-set boundaries

        L.polyline(
            coordinates,
            {
                color: startingColor,
                weight: 2,
                opacity: 1,
                lineJoin: 'round',
            },
        ).addTo(map);
        //.bindTooltip(data[i].name + "<br>" + data[i].miles + " miles<br>" + data[i].start_date_local.split("T")[0], {sticky: true, className: 'myCSSClass'});
    });

    function delayLength(i, total_length = 0) {
        //Use recursion to find sum of all previous line lengths
        if (i==0){
            return total_length
        } 
        else{
            return (speed * d3.select("#heatmap").selectAll("path")._groups[0][i - 1].getTotalLength()) + delayLength(i-1, total_length)
        }
    }
    
    // set opacity of all lines and animate them
    d3.select("#heatmap").selectAll("path")
        .style("opacity", 1)
        .attr('stroke-dasharray', function(d, i){ return this.getTotalLength();}) // line starts completely in a dash offset
        .attr('stroke-dashoffset', function(d){ return this.getTotalLength();})
        .transition()
        .duration(function(d){ return speed * this.getTotalLength();}) // makes animation time correspond to length of run line
        .ease(d3.easeLinear)
        .delay(function(d,i) {
            if (fastForward == 'N') { return delayLength(i) }
            else {return 0}
        }) // remove this to start all lines animations at the same time
        .attr('stroke-dashoffset', 0) // transition dash offset to 0, creating animation illusion
        .transition()
        .duration(1000)
        .style("opacity", 0.3) // fade line out
        .style("stroke", endingColor); // fade line to endingColor value

    // wait till animation finishes, then re-enable dragging and zooming   
    timer = setTimeout(function() {
        enableZoom();
    }, delayLength(d3.select("#heatmap").selectAll("path")._groups[0].length));
}

function enableZoom() {
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    $(".leaflet-control-zoom").css("opacity", 1).css("pointer-events", "initial");
    map.options.minZoom = 1;
    map.options.maxZoom = 14;
}
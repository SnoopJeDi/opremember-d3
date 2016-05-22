  var casualtyjson = {}; // Global var to contain JSON...async grossness
  var casualtyFilters = {
    bytime: function() { return true; },
    bycounty: function() { return true; },
    bystate: function() { return true; },
    byphoto: function() { return true; }
  };
$( function() {
  var remaining = 3; // Global var to trigger post-load processing

  var width = 712,
      height = 400;

  var defaulttext = "Mouse over a county or personnel node to see its name.  Click a personnel node to see photos associated with that node."
  d3.select("#curr").text(defaulttext)

  // Thanks to StackOverflow user Peter Bailey for this nice little diddy
  // http://stackoverflow.com/a/1267338
  // Fills a number (e.g. 33) to a fixed width string by padding with leading zeroes ("033")
  function zeroFill( number, width ) {
    width -= number.toString().length;
    if ( width > 0 ) {
      return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
    }
    return number + ""; // always return a string
  }

  var projection = d3.geo.mercator()
    .center([-77,37+50/60])
    .scale(7000)
    .translate([width/2,height*0.9])

  var path = d3.geo.path()
      .projection(projection);

  var svg = d3.select("#mdmap")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 600 400");

  svg.append("g").attr("id","geo");

  $("#slider").slider({
      value:1975,
      min: 1955,
      max: 1990,
      step: 1,
      slide: function( event, ui ) {
        casualtyFilters.bytime = function(d) { return (new Date(d.casdate)).getUTCFullYear() <= ui.value; };
        var numvisible = filterCasualties().size();
      }
    });

  filterCasualties = function() {
    var filters = d3.values(casualtyFilters);
    var casualtiesToShow = d3.selectAll("circle.name")
    for(var i=0; i<filters.length; i++) {
      casualtiesToShow = casualtiesToShow.filter( function(d) { return filters[i](d); } );
    }
    d3.selectAll("circle").style("visibility", "hidden");
    casualtiesToShow.style("visibility", "visible");
    $("#year").text("Showing casualties on or before " + $("#slider").slider("value") + " (" + casualtiesToShow.size() + " total)");
    return casualtiesToShow;
  }

  function toBottomOfParent(el) {
    // SVG z-layering is just draw order, so move to bottom of parentNode
    // TODO: check if this isn't an SVG element, by crawling upwards in the DOM
    el.parentNode.appendChild(el);
  }

  function isZoomed(el) {
    return d3.select(el).attr("zoom") > 1;
  }

  function zoomCounty(d) {
    toBottomOfParent(this.parentNode);
    t = d3.select(this);
    countyid = d.properties.COUNTYFP;
    stateid = d.properties.STATEFP;
    zoomfactor = 4
    // select this element and its name container sibling
    if (isZoomed(this)) {
      casualtyFilters.bycounty = function(d) { return true };
      casualtyFilters.bystate = function(d) { return true; };
    } else {
      casualtyFilters.bycounty = function(d) { return zeroFill(d.countyid,3) === zeroFill(countyid,3); };
      casualtyFilters.bystate = function(d) { return d.stateid === stateid; };
    }
    filterCasualties();
    var names = d3.select(".namescontainer > g[stateid='" + stateid + "'] > .countynames[countyid='" + countyid + "']");
    t.push( names[0] );
    c = path.centroid(d);
    c.x = c[0];
    c.y = c[1];
    t.each(function() { toBottomOfParent(this); });
    t.attr("zoom", (isZoomed(this) ? 1 : zoomfactor))
    .each( function(d) {
      d3.select(this).selectAll("circle")
        .attr("zoom", function() { return isZoomed(this) ? 1 : zoomfactor })
        .transition()
        .duration(500)
        .attr("r", function(d) { // make circle fill size zoom-invariant (stroke width still varies?)
          return d3.select(this).attr("r") * (isZoomed(this) ? 1/zoomfactor : zoomfactor);
        });
    })
    .transition()
    .duration(500)
    // This would be simpler than translating twice, but I can't get it to work...
    // .attr("transform-origin", [c.x,c.y].join(' '))
    // transform applied right-to-left. So, translate to origin, scale, translate back.
    // pretty sure the operators are aliases for the matrix transform, which explains this
    // TODO: circles get larger with this scaling, but this is not terribly desireable (transition r to r/zoomfactor to compensate?)
    .attr("transform", "translate(" + (c.x) + "," + (c.y) +") " +
      "scale(" + t.attr("zoom") +") " +
      "translate(" + [-c.x,-c.y].join(',') + ") "
    )
    //
    // z-index cleanup - after a zoom finishes, all circles should be on top
    // might also be helpful to use Node.insertBefore() ?
    // TODO: this can be interrupted, but there should only ever be one zoomed county anyway!
    .each("end", function() { if (!isZoomed(this)) {
      d3.selectAll(".names").each( function() { toBottomOfParent(this);} );
    }})
  }

  d3.json("json/MD.json", function(error, mapdata) {
    svg.select("#geo")
      .append("g").attr("id","MD")
      .selectAll("path")
      .data(topojson.feature(mapdata, mapdata.objects.out).features)
      .enter()
      .append("g")
      .classed("countygeom",true)
      .attr("countyid", function(d) { return d.properties.COUNTYFP; })
      .attr("stateid", function(d) { return d.properties.STATEFP; })
      .attr("zoom", 1)
      .on('click', zoomCounty)
      .append("path")
      .attr("d", path)
      .attr("zoom", 1)
      .on('mouseover', function(d,i) {
        toBottomOfParent(this.parentNode);
        var countyid = this.parentNode.getAttribute("countyid");
        d3.select("#curr").text(
          d.properties.NAME + ", casualties: " +
          d3.selectAll(".countynames[countyid='" + countyid + "'] > circle").size()
        )
      })
      .on('mouseout', function(d,i) { d3.select("#curr").text(defaulttext) })
    if(!--remaining) {
      doCasualties(casualtyjson);
    }
  });

  d3.json("json/DC.json", function(error, mapdata) {
    svg.select("#geo")
      .append("g")
      .attr("id","DC")
      .selectAll("path")
      .data(topojson.feature(mapdata, mapdata.objects.out).features)
      .enter()
      .append("g")
      .attr("countyid", function(d) { return d.properties.COUNTYFP; })
      .attr("stateid", function(d) { return d.properties.STATEFP; })
      .attr("zoom", 1)
      .on('click', zoomCounty)
      .classed("DCgeom",true)
      .append("path")
      .attr("d", path)
      .attr("zoom", 1)
    if(!--remaining) {
      doCasualties(casualtyjson);
    }
  });
  function showCasualties() {
    var showtype = d3.select("#showcasualties").node().checked &&
      d3.selectAll("input[name='showtype']").filter(function(d){
        return this.checked
      }).node().value;
    casualtyFilters.byphoto = function(d) {
      if(showtype === false) {
        return false;
      } else if(showtype === "all") {
        return true;
      } else {
        return showtype === "withphoto" ? d.hasphoto : !d.hasphoto;
      }
    };
    filterCasualties();
  }
  d3.select("#showcasualties").on("change",function() { showCasualties() });
  d3.select("#choropleth").on("change",function() {
    if (d3.select("#choropleth").node().checked) {
      doChoropleth();
    } else {
      d3.selectAll(".countygeom,.DCgeom").style("fill", null);
      d3.select(".legendQuant").style("visibility","hidden");
    }
  });

  d3.selectAll("input[name='showtype']").on("change", function() {
    d3.select("#showcasualties").node().checked = true;
    showCasualties();
  });


  d3.json("json/bystate.json", function(e,json) {
      casualtyjson = json;
      if (e) console.log(e)
      if(!--remaining) {
          doCasualties(casualtyjson);
      }
  })

  function hoverCircle(d){
    d3.select("#curr")
      .text(d.lname + ", " + d.fname +
        "  ; HOMETOWN: " + d.hometown +
        " (county: " + d.county + " )" )
  }

  function clickCircle(d) {
    d3.selectAll("#casualtyinfo>.row>div.text-left").text("")
    d3.select("#cas-name").text(d.fname + " " + d.lname);
    if (d.hasphoto && d.photo) {
      d3.select("#cas-pic").select("img").attr("src","img/"+d.photo);
    } else {
      d3.select("#cas-pic").select("img").attr("src","img/1111.png");
    }
    d3.select("#COUNTY").text(d.county);
    var casdate = d.casdate !== null ? (new Date(d.casdate)).toLocaleDateString("en-us") : "Casualty date unknown";
    d3.select("#CASDATE").text(casdate);
  }

  function createCircle(d) {
    // Using createElementNS is necessary, <circle> is not meaningful in the HTML namespace
    elem = d3.select(document.createElementNS("http://www.w3.org/2000/svg", "circle"))
      .classed("name", true)
      .classed("missingphoto", function() {
        if(typeof(d.hasphoto) === "boolean") {
          return !d.hasphoto;
        } else {
          return false;
        }
      })
      .classed("badloc", function() { return d.badloc })
      .attr("recid", d.recid)
      .attr("zoom", 1)
      .attr("r", 3)
      .attr("transform", function() {
        var lat,lon;
        if ( d.badloc && d.longitude == -78 ) {
          d.longitude = -78.69971 + Math.random(); // randomly spread out the badlocs that are other states/etc.
          d.latitude = 39 - Math.random();
        }
        lat = d.latitude;
        lon = d.longitude;

        proj = projection([lon,lat])
        return "translate("+ proj[0] +"," + proj[1] + ")"
      })
      .on("mouseover",hoverCircle)
      .on("mouseout", function(d,i) { d3.select("#curr").text(defaulttext) })
      .on("click", clickCircle);
    return elem.node();
  }
  function doCasualties(casualtyjson) {
    svg.append("g").classed("namescontainer",true)
      .selectAll("g")
      .data(casualtyjson)
      .enter()
      .append("g")
      .attr("stateid", function(d,i) { return d.stateid; })
      .each( function(d,i) {
        var stateid = d.stateid;
        d3.select(this)
        .selectAll(".countynames")
        .data(d3.values(d.counties))
        .enter()
        .append("g")
        .classed("countynames", true)
        .attr("countyid", function(d) { return zeroFill(d.countyid,3) })
        .each( function(d,i) {
          d3.select(this)
          .selectAll(".names")
          .data(d.casualties)
          .enter()
          .append(createCircle)
        })
      });
    d3.selectAll(".badloc").style("fill","red"); // color bad locations red, for now
    filterCasualties();
  }

  var colorscale;
  function doChoropleth() {
    colorscale = d3.scale.threshold()
      .domain([0,5,10,20,50,100,1046])
      .range(['#feedde','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#8c2d04'])
    d3.selectAll(".countynames>g")
      .each( function(d) {
        d3.select(".countygeom[countyid='"+zeroFill(d.countyid,3) +"']")
          .style("fill",function() {
            return colorscale(d.casualties.length);
          });
      });
    var DCcas = casualtyjson.filter( function(d) { return d.casualties[0].hometown == "WASHINGTON DC" })[0].casualties.length;
    d3.select(".DCgeom")
    .style("fill",function() {
      return colorscale(DCcas);
    });
    var legend = d3.legend.color()
      .labelFormat(d3.format(".2f"))
      .useClass(true)
      .scale(colorscale);
    svg.select(".legendQuant")
      .style("visibility","visible")
      .call(legend);
    d3.selectAll("rect.swatch").style("fill", function(d) { return d }); // something kinda screwy with the legend library so that this is necessary
  }

    svg.append("g")
      .attr("class", "legendQuant")
      .attr("transform", "translate(20,200)")
      .style("visibility","hidden");

  d3.select(self.frameElement).style("height", height + "px");
});

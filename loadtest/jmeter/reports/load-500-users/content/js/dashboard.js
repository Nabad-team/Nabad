/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 99.99568102964254, "KoPercent": 0.00431897035746678};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.971278847122846, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.996984672083089, 500, 1500, "B1 Landing page /"], "isController": false}, {"data": [0.9986486486486487, 500, 1500, "S02 Dashboard GET /api/auth/me"], "isController": false}, {"data": [0.9991891891891892, 500, 1500, "S03 Dashboard GET /api/profile/me"], "isController": false}, {"data": [0.9978249048395867, 500, 1500, "S07 Medications GET /api/medications"], "isController": false}, {"data": [0.9986095661846496, 500, 1500, "S10 Water and sleep GET /api/wellbeing/today"], "isController": false}, {"data": [0.99683303775019, 500, 1500, "B2 Login page /login"], "isController": false}, {"data": [0.9997219132369299, 500, 1500, "S11 Water and sleep GET /api/wellbeing/history"], "isController": false}, {"data": [0.9965159755268524, 500, 1500, "B3 Signup page /signup"], "isController": false}, {"data": [0.9983426823049465, 500, 1500, "B4 API ready /api/health/ready"], "isController": false}, {"data": [0.09911460895228726, 500, 1500, "S01 Log in POST /api/auth/login"], "isController": false}, {"data": [0.9978378378378379, 500, 1500, "S06 Dashboard GET /api/health-profile"], "isController": false}, {"data": [0.9997297297297297, 500, 1500, "S04 Dashboard GET /api/profile/linked"], "isController": false}, {"data": [0.9983783783783784, 500, 1500, "S05 Dashboard GET /api/wellbeing/today"], "isController": false}, {"data": [0.9978082191780822, 500, 1500, "S08 Add medication POST /api/medications"], "isController": false}, {"data": [0.9975206611570248, 500, 1500, "S09 My health GET /api/health-profile"], "isController": false}, {"data": [0.9986025712688653, 500, 1500, "S12 Log out POST /api/auth/logout"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 69461, 3, 0.00431897035746678, 386.7893638156673, 2, 19360, 18.0, 151.0, 272.9500000000007, 17404.99, 373.0250792116428, 775.5801686436013, 115.486059715845], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["B1 Landing page /", 11939, 0, 0.0, 32.53019515872371, 3, 626, 11.0, 67.0, 150.0, 403.60000000000036, 66.69720619207499, 266.9190927491439, 14.590013854516405], "isController": false}, {"data": ["S02 Dashboard GET /api/auth/me", 1850, 0, 0.0, 42.52702702702703, 5, 712, 19.0, 103.90000000000009, 165.89999999999964, 337.74000000000024, 10.40272607654157, 10.407404667450152, 4.845899955296393], "isController": false}, {"data": ["S03 Dashboard GET /api/profile/me", 1850, 0, 0.0, 38.87783783783791, 5, 684, 17.0, 94.90000000000009, 156.89999999999964, 319.49, 10.401848717761297, 10.376052747915413, 4.875965421584117], "isController": false}, {"data": ["S07 Medications GET /api/medications", 1839, 0, 0.0, 41.70473083197385, 6, 793, 19.0, 100.0, 155.0, 404.59999999999764, 10.379685392243738, 12.96008284452202, 5.027748302506589], "isController": false}, {"data": ["S10 Water and sleep GET /api/wellbeing/today", 1798, 0, 0.0, 49.793103448275915, 7, 953, 24.0, 120.10000000000014, 188.0, 334.0899999999999, 10.315370360808478, 9.237550773652778, 5.198035622593989], "isController": false}, {"data": ["B2 Login page /login", 11841, 0, 0.0, 33.72705008022975, 3, 692, 11.0, 70.0, 152.89999999999964, 404.0, 66.38299303710183, 178.27463950393556, 14.845415435054997], "isController": false}, {"data": ["S11 Water and sleep GET /api/wellbeing/history", 1798, 0, 0.0, 39.34204671857617, 6, 641, 19.0, 96.0, 142.19999999999982, 287.03999999999996, 10.31448272697025, 11.976540360146398, 5.278170229838571], "isController": false}, {"data": ["B3 Signup page /signup", 11768, 0, 0.0, 33.70079877634271, 3, 673, 11.0, 68.0, 151.0, 423.9299999999985, 66.37150672569865, 202.16086863032626, 14.907662643467471], "isController": false}, {"data": ["B4 API ready /api/health/ready", 11766, 3, 0.025497195308516064, 32.6835798062214, 2, 1588, 12.0, 81.0, 128.64999999999964, 295.3299999999999, 66.35573577265576, 33.50225051567249, 15.552125571716191], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 2033, 0, 0.0, 11989.527791441236, 220, 19360, 13302.0, 17673.6, 18176.1, 18789.64, 10.927463785643258, 10.890116680440217, 3.7990010817275395], "isController": false}, {"data": ["S06 Dashboard GET /api/health-profile", 1850, 0, 0.0, 53.47621621621626, 6, 15567, 21.0, 89.90000000000009, 133.0, 242.98000000000002, 10.398633001326528, 13.636678613384447, 5.067401409717382], "isController": false}, {"data": ["S04 Dashboard GET /api/profile/linked", 1850, 0, 0.0, 35.996756756756795, 4, 517, 17.0, 90.0, 136.44999999999982, 275.98, 10.400620664065574, 8.42013254466645, 4.916017184214669], "isController": false}, {"data": ["S05 Dashboard GET /api/wellbeing/today", 1850, 0, 0.0, 53.63459459459466, 6, 18053, 21.0, 103.90000000000009, 163.44999999999982, 320.45000000000005, 10.398866804568756, 9.312365271438528, 5.240152782540021], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 1825, 0, 0.0, 52.770958904109634, 7, 831, 23.0, 134.4000000000001, 202.0, 452.96000000000004, 10.34017768108059, 12.738243492416258, 6.931991376575106], "isController": false}, {"data": ["S09 My health GET /api/health-profile", 1815, 0, 0.0, 56.09807162534439, 6, 6417, 26.0, 123.0, 180.19999999999982, 408.99999999999795, 10.331401769145824, 13.816398778945002, 5.0346072163987525], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 1789, 0, 0.0, 40.66349916154275, 4, 12474, 15.0, 78.0, 123.5, 288.9999999999991, 10.320816434847323, 6.25901074808612, 5.049596410429851], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["503/Service Unavailable", 3, 100.0, 0.00431897035746678], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 69461, 3, "503/Service Unavailable", 3, "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["B4 API ready /api/health/ready", 11766, 3, "503/Service Unavailable", 3, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});

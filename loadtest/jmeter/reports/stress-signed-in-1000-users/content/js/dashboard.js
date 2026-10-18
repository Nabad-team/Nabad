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

    var data = {"OkPercent": 87.5667022411953, "KoPercent": 12.433297758804695};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.24204909284951975, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.29754601226993865, 500, 1500, "S02 Dashboard GET /api/auth/me"], "isController": false}, {"data": [0.29570552147239265, 500, 1500, "S03 Dashboard GET /api/profile/me"], "isController": false}, {"data": [0.2705521472392638, 500, 1500, "S07 Medications GET /api/medications"], "isController": false}, {"data": [0.04570707070707071, 500, 1500, "S01 Log in POST /api/auth/login"], "isController": false}, {"data": [0.294478527607362, 500, 1500, "S06 Dashboard GET /api/health-profile"], "isController": false}, {"data": [0.29570552147239265, 500, 1500, "S04 Dashboard GET /api/profile/linked"], "isController": false}, {"data": [0.29570552147239265, 500, 1500, "S05 Dashboard GET /api/wellbeing/today"], "isController": false}, {"data": [0.23558282208588957, 500, 1500, "S08 Add medication POST /api/medications"], "isController": false}, {"data": [0.23113854595336078, 500, 1500, "S09 My health GET /api/health-profile"], "isController": false}, {"data": [0.3275462962962963, 500, 1500, "S10 Water and sleep GET /api/wellbeing/today"], "isController": false}, {"data": [0.44556451612903225, 500, 1500, "S12 Log out POST /api/auth/logout"], "isController": false}, {"data": [0.5036231884057971, 500, 1500, "S11 Water and sleep GET /api/wellbeing/history"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 9370, 1165, 12.433297758804695, 10196.191035218779, 5, 30034, 5000.0, 30004.0, 30010.0, 30016.0, 59.68304924966241, 71.461402181425, 25.597250984897702], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["S02 Dashboard GET /api/auth/me", 815, 0, 0.0, 8227.093251533737, 6, 15703, 9717.0, 14890.8, 15236.599999999999, 15540.2, 10.622352557836429, 10.624669069729554, 4.953173366731835], "isController": false}, {"data": ["S03 Dashboard GET /api/profile/me", 815, 0, 0.0, 6002.860122699388, 6, 15696, 2714.0, 14884.199999999999, 15255.4, 15551.84, 10.241395342992497, 10.213624688202918, 4.805538168046847], "isController": false}, {"data": ["S07 Medications GET /api/medications", 815, 0, 0.0, 8260.647852760732, 6, 18961, 5245.0, 18699.4, 18786.2, 18909.84, 7.057499134049186, 6.117350542301697, 3.421841850320402], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 1980, 1165, 58.83838383838384, 24467.58737373743, 200, 30034, 30004.0, 30014.0, 30016.0, 30017.0, 12.611786287548728, 24.81774142533886, 1.8047583616780045], "isController": false}, {"data": ["S06 Dashboard GET /api/health-profile", 815, 0, 0.0, 6362.719018404909, 7, 18946, 4203.0, 18437.0, 18804.2, 18915.0, 7.522336262275714, 7.955193281930702, 3.669257108723141], "isController": false}, {"data": ["S04 Dashboard GET /api/profile/linked", 815, 0, 0.0, 3638.9828220858913, 6, 15616, 2899.0, 12064.8, 14536.6, 15445.840000000004, 9.733551492278846, 7.875130813259128, 4.605265858821703], "isController": false}, {"data": ["S05 Dashboard GET /api/wellbeing/today", 815, 0, 0.0, 3126.5484662576687, 8, 15552, 2916.0, 4728.4, 10691.0, 14530.04, 9.039284842838446, 7.984304467236751, 4.559262944754996], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 815, 0, 0.0, 6086.711656441726, 9, 18874, 4701.0, 17320.0, 18415.8, 18811.2, 5.964098323466349, 7.345761568246847, 4.0026048908350464], "isController": false}, {"data": ["S09 My health GET /api/health-profile", 729, 0, 0.0, 8903.748971193407, 8, 18851, 5573.0, 18571.0, 18633.0, 18749.0, 5.3975611020205685, 6.595197031341393, 2.6330622713995897], "isController": false}, {"data": ["S10 Water and sleep GET /api/wellbeing/today", 432, 0, 0.0, 9335.458333333343, 8, 18765, 8968.5, 18583.4, 18631.1, 18746.73, 3.275605835431137, 2.8937746665630404, 1.6526271429817114], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 248, 0, 0.0, 4521.782258064515, 5, 18593, 2852.0, 14595.9, 15448.149999999998, 18395.78, 1.903110203893702, 1.152273756263765, 0.9326103305119214], "isController": false}, {"data": ["S11 Water and sleep GET /api/wellbeing/history", 276, 0, 0.0, 5280.072463768115, 7, 18781, 47.5, 16968.8, 18203.5, 18639.760000000002, 2.0957515471354267, 2.436990418201147, 1.0739332596150195], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 1165, 100.0, 12.433297758804695], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 9370, 1165, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 1165, "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 1980, 1165, "Non HTTP response code: java.net.SocketTimeoutException/Non HTTP response message: Read timed out", 1165, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});

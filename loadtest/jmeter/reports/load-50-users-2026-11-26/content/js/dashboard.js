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

    var data = {"OkPercent": 100.0, "KoPercent": 0.0};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [1.0, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [1.0, 500, 1500, "B1 Landing page /"], "isController": false}, {"data": [1.0, 500, 1500, "S02 Dashboard GET /api/auth/me"], "isController": false}, {"data": [1.0, 500, 1500, "S03 Dashboard GET /api/profile/me"], "isController": false}, {"data": [1.0, 500, 1500, "S07 Medications GET /api/medications"], "isController": false}, {"data": [1.0, 500, 1500, "S10 Water and sleep GET /api/wellbeing/today"], "isController": false}, {"data": [1.0, 500, 1500, "B2 Login page /login"], "isController": false}, {"data": [1.0, 500, 1500, "S11 Water and sleep GET /api/wellbeing/history"], "isController": false}, {"data": [1.0, 500, 1500, "B3 Signup page /signup"], "isController": false}, {"data": [1.0, 500, 1500, "B4 API ready /api/health/ready"], "isController": false}, {"data": [1.0, 500, 1500, "S01 Log in POST /api/auth/login"], "isController": false}, {"data": [1.0, 500, 1500, "S06 Dashboard GET /api/health-profile"], "isController": false}, {"data": [1.0, 500, 1500, "S04 Dashboard GET /api/profile/linked"], "isController": false}, {"data": [1.0, 500, 1500, "S05 Dashboard GET /api/wellbeing/today"], "isController": false}, {"data": [1.0, 500, 1500, "S08 Add medication POST /api/medications"], "isController": false}, {"data": [1.0, 500, 1500, "S09 My health GET /api/health-profile"], "isController": false}, {"data": [1.0, 500, 1500, "S12 Log out POST /api/auth/logout"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 11044, 0, 0.0, 18.046450561390856, 2, 376, 7.0, 16.0, 33.0, 249.0, 61.582727394388186, 110.01514898186922, 22.949164295651737], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["B1 Landing page /", 1241, 0, 0.0, 5.269943593875901, 2, 47, 4.0, 8.0, 11.0, 16.0, 6.924759502711872, 31.161417762203424, 1.514791141218222], "isController": false}, {"data": ["S02 Dashboard GET /api/auth/me", 514, 0, 0.0, 9.33852140077821, 4, 34, 8.0, 15.0, 18.25, 24.850000000000023, 2.902675657055083, 2.9866450977817682, 1.355037134059567], "isController": false}, {"data": ["S03 Dashboard GET /api/profile/me", 514, 0, 0.0, 8.6284046692607, 4, 39, 7.0, 14.0, 19.0, 31.550000000000068, 2.9029051642344013, 2.8961654578288076, 1.3636488783716623], "isController": false}, {"data": ["S07 Medications GET /api/medications", 510, 0, 0.0, 10.419607843137268, 5, 48, 9.0, 16.0, 21.0, 31.889999999999986, 2.897052391204322, 3.824642812256804, 1.4061443782982375], "isController": false}, {"data": ["S10 Water and sleep GET /api/wellbeing/today", 502, 0, 0.0, 10.731075697211159, 4, 39, 9.0, 16.0, 20.0, 32.93999999999994, 2.887729450813684, 2.5888155671339574, 1.4579762021180518], "isController": false}, {"data": ["B2 Login page /login", 1234, 0, 0.0, 5.041329011345223, 2, 29, 4.0, 8.0, 10.0, 17.65000000000009, 6.932584269662922, 18.692251141151687, 1.5503533181179776], "isController": false}, {"data": ["S11 Water and sleep GET /api/wellbeing/history", 502, 0, 0.0, 9.019920318725092, 4, 33, 8.0, 14.0, 18.0, 30.90999999999991, 2.8878789622044527, 3.3560424516769256, 1.4806132428234482], "isController": false}, {"data": ["B3 Signup page /signup", 1230, 0, 0.0, 5.253658536585367, 2, 27, 4.0, 9.0, 11.0, 18.0, 6.942798116977681, 21.33690007239137, 1.559417545805534], "isController": false}, {"data": ["B4 API ready /api/health/ready", 1230, 0, 0.0, 5.704878048780485, 2, 24, 5.0, 9.0, 12.0, 19.0, 6.943425197294887, 3.50561604199361, 1.6273652806159893], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 517, 0, 0.0, 228.98065764023215, 186, 376, 225.0, 263.0, 284.09999999999997, 327.82000000000005, 2.888784587188771, 2.8792736777664163, 1.0043040166398463], "isController": false}, {"data": ["S06 Dashboard GET /api/health-profile", 514, 0, 0.0, 9.787937743190659, 5, 30, 9.0, 14.0, 17.25, 24.0, 2.904004022667051, 3.737279754388492, 1.4180479577337468], "isController": false}, {"data": ["S04 Dashboard GET /api/profile/linked", 514, 0, 0.0, 8.081712062256809, 4, 38, 7.0, 14.0, 17.0, 26.0, 2.903429888381761, 2.3534432510789007, 1.37523689220028], "isController": false}, {"data": ["S05 Dashboard GET /api/wellbeing/today", 514, 0, 0.0, 9.206225680933851, 4, 43, 8.0, 14.0, 17.0, 28.0, 2.9037415331077376, 2.603236150028529, 1.4661264285673934], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 508, 0, 0.0, 12.48818897637795, 6, 72, 10.0, 18.0, 25.0, 43.729999999999905, 2.897129104741482, 3.7491944498306204, 1.9441472146498922], "isController": false}, {"data": ["S09 My health GET /api/health-profile", 504, 0, 0.0, 12.132936507936503, 6, 72, 11.0, 18.0, 23.0, 35.94999999999999, 2.8914169664216995, 3.7636893211193914, 1.4118471005513198], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 496, 0, 0.0, 7.745967741935487, 3, 31, 7.0, 12.0, 15.0, 23.059999999999945, 2.8715336073640945, 1.7414280958721706, 1.4077018685231286], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": []}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 11044, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});

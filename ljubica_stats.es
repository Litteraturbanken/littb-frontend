LB totalt live, verk (epub eller pdf) som har show= true  1458 + 389 = 1847
keyword=1800    7108
show=true: 5407
show=false: 1701
keyword = TM1880    1290
show = true 1258
show = false 32
Av verk som har keyword=1800:
searchable = false: 464



GET littb-live_etext,littb-live_faksimil/_search {
    "query": {
        "bool": {
        "must": [
            {
            "term": {
                "show": true
            }
            }
        ]
        }
    },
    "aggs": {
        "total": {
        "cardinality": {
            "field": "keyword"
        }
        }
    }
}





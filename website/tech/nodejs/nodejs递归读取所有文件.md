---
title: nodejs递归读取所有文件
date: 2019-12-26
tags:
  - null
section: tech
---

# nodejs递归读取所有文件

<p class="article-meta"><time datetime="2019-12-26">2019-12-26</time></p>

```js

var fs = require('fs');
var path = require('path');
 
function readFileList(dir, filesList = []) {
    const files = fs.readdirSync(dir);
    console.log(files);
    files.forEach((item, index) => {
        var fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {      
            readFileList(path.join(dir, item), filesList);  //递归读取文件
        } else {                
            filesList.push(fullPath);                     
        }        
    });
    return filesList;
}
 
var filesList = [];
readFileList(__dirname,filesList);
```


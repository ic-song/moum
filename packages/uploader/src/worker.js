self.onmessage = async ({data}) => {
  try {
    if(/\.(xlsx|xls)$/i.test(data.file?.name||''))importScripts('../vendor/sheetjs/xlsx.full.min.js');
    const result=await parseUploadFile(data.file,{...data.options,onParseStage:stage=>self.postMessage({stage})});
    self.postMessage({result});
  }catch(error){self.postMessage({error:{name:error.name,message:error.message}});}
};

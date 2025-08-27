// Simple HTML minifier (safe, conservative)
export function minify(html){
  return html
    // remove HTML comments except <!DOCTYPE and conditional
    .replace(/<!--(?!\[if|<!|>).*?-->/gs,'')
    // collapse consecutive whitespace between tags
    .replace(/>\s+</g,'><')
    // trim leading/trailing whitespace
    .trim();
}


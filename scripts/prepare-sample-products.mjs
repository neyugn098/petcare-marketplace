import fs from 'node:fs/promises';
await fs.mkdir('public/products',{recursive:true});
const picks=[['XM011-01','Thức ăn'],['CN009-02','Phụ kiện'],['QA016','Phụ kiện'],['DC039','Đồ chơi'],['BX060-01','Thức ăn']];
const result=[];
for (const [sku,category] of picks) {
 const url=`https://hachikopet.vn/marketplace_v2/product.php?sku=${sku}`;
 const r=await fetch(url); if(!r.ok)throw Error(url);
 const html=await r.text(); const p=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1])).find(p=>p['@type']==='Product');
 if(!p)throw Error('Missing product '+sku);
 result.push({id:'sample-hachiko-'+sku.toLowerCase(),name:p.name,category,price:Number(p.offers.price),image_source:new URL(p.image,url).href,source_url:url,shop_name:'Hachiko Petshop',shop_address:'128 Hoàng Diệu 2, Thủ Đức, TP. Hồ Chí Minh',shop_address_source:'https://hachikopetmall.vn/he-thong-cua-hang/',description:'Sản phẩm tham khảo từ danh mục Hachiko. Tồn kho tại chi nhánh cần liên hệ xác nhận.'});
}
for(const [slug,category] of [['pate-monge-cho-nhieu-vi','Thức ăn'],['khan-uot-cho-absorb-plus-khang-khuan','Chăm sóc'],['banh-thuong-cho-cho-pedigree-schmackos-70g','Thức ăn']]){
 const url='https://paddy.vn/products/'+slug; const html=await(await fetch(url)).text();
 const group=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1])).find(p=>p['@type']==='ProductGroup');
 const p=group.hasVariant[0];
 result.push({id:'sample-paddy-'+p.sku.toLowerCase(),name:p.name,category,price:Number(p.offers.price),image_source:p.image,source_url:p.offers.url,shop_name:'Paddy Pet Shop',shop_address:'36 Mạc Đĩnh Chi, phường Tân Định, TP. Hồ Chí Minh',shop_address_source:'https://paddy.vn/',description:'Sản phẩm tham khảo từ danh mục Paddy. Tồn kho tại cửa hàng cần liên hệ xác nhận.'});
}
for(const p of result){const r=await fetch(p.image_source); if(!r.ok || !r.headers.get('content-type')?.startsWith('image/'))throw Error('Image failed '+p.id);const ext=r.headers.get('content-type').includes('png')?'png':r.headers.get('content-type').includes('webp')?'webp':'jpg';p.image_url=`/products/${p.id}.${ext}`;await fs.writeFile('public'+p.image_url,Buffer.from(await r.arrayBuffer()));p.price_checked_at='2026-10-04'; console.log(p.name,p.price,p.image_url);}
await fs.writeFile('data/sample-products.json',JSON.stringify(result,null,2)+'\n');

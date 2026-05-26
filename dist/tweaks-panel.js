const __TWEAKS_STYLE=`
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;function useTweaks(i){const[e,n]=React.useState(i),a=React.useCallback((t,r)=>{const o=typeof t=="object"&&t!==null?t:{[t]:r};n(d=>({...d,...o})),window.parent.postMessage({type:"__edit_mode_set_keys",edits:o},"*"),window.dispatchEvent(new CustomEvent("tweakchange",{detail:o}))},[]);return[e,a]}function TweaksPanel({title:i="Tweaks",children:e}){const[n,a]=React.useState(!1),t=React.useRef(null),r=React.useRef({x:16,y:16}),o=16,d=React.useCallback(()=>{const s=t.current;if(!s)return;const p=s.offsetWidth,u=s.offsetHeight,w=Math.max(o,window.innerWidth-p-o),x=Math.max(o,window.innerHeight-u-o);r.current={x:Math.min(w,Math.max(o,r.current.x)),y:Math.min(x,Math.max(o,r.current.y))},s.style.right=r.current.x+"px",s.style.bottom=r.current.y+"px"},[]);React.useEffect(()=>{if(!n)return;if(d(),typeof ResizeObserver>"u")return window.addEventListener("resize",d),()=>window.removeEventListener("resize",d);const s=new ResizeObserver(d);return s.observe(document.documentElement),()=>s.disconnect()},[n,d]),React.useEffect(()=>{const s=p=>{const u=p?.data?.type;u==="__activate_edit_mode"?a(!0):u==="__deactivate_edit_mode"&&a(!1)};return window.addEventListener("message",s),window.parent.postMessage({type:"__edit_mode_available"},"*"),()=>window.removeEventListener("message",s)},[]);const g=()=>{a(!1),window.parent.postMessage({type:"__edit_mode_dismissed"},"*")},k=s=>{const p=t.current;if(!p)return;const u=p.getBoundingClientRect(),w=s.clientX,x=s.clientY,f=window.innerWidth-u.right,c=window.innerHeight-u.bottom,l=h=>{r.current={x:f-(h.clientX-w),y:c-(h.clientY-x)},d()},b=()=>{window.removeEventListener("mousemove",l),window.removeEventListener("mouseup",b)};window.addEventListener("mousemove",l),window.addEventListener("mouseup",b)};return n?React.createElement(React.Fragment,null,React.createElement("style",null,__TWEAKS_STYLE),React.createElement("div",{ref:t,className:"twk-panel","data-omelette-chrome":"",style:{right:r.current.x,bottom:r.current.y}},React.createElement("div",{className:"twk-hd",onMouseDown:k},React.createElement("b",null,i),React.createElement("button",{className:"twk-x","aria-label":"Close tweaks",onMouseDown:s=>s.stopPropagation(),onClick:g},"\u2715")),React.createElement("div",{className:"twk-body"},e))):null}function TweakSection({label:i,children:e}){return React.createElement(React.Fragment,null,React.createElement("div",{className:"twk-sect"},i),e)}function TweakRow({label:i,value:e,children:n,inline:a=!1}){return React.createElement("div",{className:a?"twk-row twk-row-h":"twk-row"},React.createElement("div",{className:"twk-lbl"},React.createElement("span",null,i),e!=null&&React.createElement("span",{className:"twk-val"},e)),n)}function TweakSlider({label:i,value:e,min:n=0,max:a=100,step:t=1,unit:r="",onChange:o}){return React.createElement(TweakRow,{label:i,value:`${e}${r}`},React.createElement("input",{type:"range",className:"twk-slider",min:n,max:a,step:t,value:e,onChange:d=>o(Number(d.target.value))}))}function TweakToggle({label:i,value:e,onChange:n}){return React.createElement("div",{className:"twk-row twk-row-h"},React.createElement("div",{className:"twk-lbl"},React.createElement("span",null,i)),React.createElement("button",{type:"button",className:"twk-toggle","data-on":e?"1":"0",role:"switch","aria-checked":!!e,onClick:()=>n(!e)},React.createElement("i",null)))}function TweakRadio({label:i,value:e,options:n,onChange:a}){const t=React.useRef(null),[r,o]=React.useState(!1),d=React.useRef(e);d.current=e;const g=c=>String(typeof c=="object"?c.label:c).length;if(!(n.reduce((c,l)=>Math.max(c,g(l)),0)<=({2:16,3:10}[n.length]??0))){const c=l=>{const b=n.find(h=>String(typeof h=="object"?h.value:h)===l);return b===void 0?l:typeof b=="object"?b.value:b};return React.createElement(TweakSelect,{label:i,value:e,options:n,onChange:l=>a(c(l))})}const p=n.map(c=>typeof c=="object"?c:{value:c,label:c}),u=Math.max(0,p.findIndex(c=>c.value===e)),w=p.length,x=c=>{const l=t.current.getBoundingClientRect(),b=l.width-4,h=Math.floor((c-l.left-2)/b*w);return p[Math.max(0,Math.min(w-1,h))].value};return React.createElement(TweakRow,{label:i},React.createElement("div",{ref:t,role:"radiogroup",onPointerDown:c=>{o(!0);const l=x(c.clientX);l!==d.current&&a(l);const b=v=>{if(!t.current)return;const m=x(v.clientX);m!==d.current&&a(m)},h=()=>{o(!1),window.removeEventListener("pointermove",b),window.removeEventListener("pointerup",h)};window.addEventListener("pointermove",b),window.addEventListener("pointerup",h)},className:r?"twk-seg dragging":"twk-seg"},React.createElement("div",{className:"twk-seg-thumb",style:{left:`calc(2px + ${u} * (100% - 4px) / ${w})`,width:`calc((100% - 4px) / ${w})`}}),p.map(c=>React.createElement("button",{key:c.value,type:"button",role:"radio","aria-checked":c.value===e},c.label))))}function TweakSelect({label:i,value:e,options:n,onChange:a}){return React.createElement(TweakRow,{label:i},React.createElement("select",{className:"twk-field",value:e,onChange:t=>a(t.target.value)},n.map(t=>{const r=typeof t=="object"?t.value:t,o=typeof t=="object"?t.label:t;return React.createElement("option",{key:r,value:r},o)})))}function TweakText({label:i,value:e,placeholder:n,onChange:a}){return React.createElement(TweakRow,{label:i},React.createElement("input",{className:"twk-field",type:"text",value:e,placeholder:n,onChange:t=>a(t.target.value)}))}function TweakNumber({label:i,value:e,min:n,max:a,step:t=1,unit:r="",onChange:o}){const d=s=>n!=null&&s<n?n:a!=null&&s>a?a:s,g=React.useRef({x:0,val:0});return React.createElement("div",{className:"twk-num"},React.createElement("span",{className:"twk-num-lbl",onPointerDown:s=>{s.preventDefault(),g.current={x:s.clientX,val:e};const p=(String(t).split(".")[1]||"").length,u=x=>{const f=x.clientX-g.current.x,c=g.current.val+f*t,l=Math.round(c/t)*t;o(d(Number(l.toFixed(p))))},w=()=>{window.removeEventListener("pointermove",u),window.removeEventListener("pointerup",w)};window.addEventListener("pointermove",u),window.addEventListener("pointerup",w)}},i),React.createElement("input",{type:"number",value:e,min:n,max:a,step:t,onChange:s=>o(d(Number(s.target.value)))}),r&&React.createElement("span",{className:"twk-num-unit"},r))}function __twkIsLight(i){const e=String(i).replace("#",""),n=e.length===3?e.replace(/./g,d=>d+d):e.padEnd(6,"0"),a=parseInt(n.slice(0,6),16);if(Number.isNaN(a))return!0;const t=a>>16&255,r=a>>8&255,o=a&255;return t*299+r*587+o*114>148e3}const __TwkCheck=({light:i})=>React.createElement("svg",{viewBox:"0 0 14 14","aria-hidden":"true"},React.createElement("path",{d:"M3 7.2 5.8 10 11 4.2",fill:"none",strokeWidth:"2.2",strokeLinecap:"round",strokeLinejoin:"round",stroke:i?"rgba(0,0,0,.78)":"#fff"}));function TweakColor({label:i,value:e,options:n,onChange:a}){if(!n||!n.length)return React.createElement("div",{className:"twk-row twk-row-h"},React.createElement("div",{className:"twk-lbl"},React.createElement("span",null,i)),React.createElement("input",{type:"color",className:"twk-swatch",value:e,onChange:o=>a(o.target.value)}));const t=o=>String(JSON.stringify(o)).toLowerCase(),r=t(e);return React.createElement(TweakRow,{label:i},React.createElement("div",{className:"twk-chips",role:"radiogroup"},n.map((o,d)=>{const g=Array.isArray(o)?o:[o],[k,...s]=g,p=s.slice(0,4),u=t(o)===r;return React.createElement("button",{key:d,type:"button",className:"twk-chip",role:"radio","aria-checked":u,"data-on":u?"1":"0","aria-label":g.join(", "),title:g.join(" \xB7 "),style:{background:k},onClick:()=>a(o)},p.length>0&&React.createElement("span",null,p.map((w,x)=>React.createElement("i",{key:x,style:{background:w}}))),u&&React.createElement(__TwkCheck,{light:__twkIsLight(k)}))})))}function TweakButton({label:i,onClick:e,secondary:n=!1}){return React.createElement("button",{type:"button",className:n?"twk-btn secondary":"twk-btn",onClick:e},i)}(function(){const e=(()=>{try{return new URLSearchParams(window.location.search)}catch{return null}})(),n=(()=>{try{return window.self!==window.top}catch{return!0}})(),a=e&&(e.has("edit")||e.has("tweaks"));if(n||a){Object.assign(window,{useTweaks,TweaksPanel,TweakSection,TweakRow,TweakSlider,TweakToggle,TweakRadio,TweakSelect,TweakText,TweakNumber,TweakColor,TweakButton});return}const t=()=>{},r=()=>null;Object.assign(window,{useTweaks:o=>[o,t],TweaksPanel:r,TweakSection:r,TweakRow:r,TweakSlider:r,TweakToggle:r,TweakRadio:r,TweakSelect:r,TweakText:r,TweakNumber:r,TweakColor:r,TweakButton:r})})();

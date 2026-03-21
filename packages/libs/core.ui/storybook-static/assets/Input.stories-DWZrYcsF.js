import{s as v,a as S,m as D,t as I}from"./iframe-oJHCjMSb.js";import{s as $}from"./sva-yFf2R5f0.js";import"./preload-helper-Dp1pzeXC.js";const L=$({slots:["root"],base:{root:{fontFamily:"body",fontSize:"14px",color:"fg.primary",bg:"bg.secondary",border:"1px solid",borderColor:"border",borderRadius:"md",outline:"none",width:"100%",transition:"all 0.15s ease",_placeholder:{color:"fg.muted"},_focus:{borderColor:"accent"},_disabled:{opacity:.5,cursor:"not-allowed"}}},variants:{size:{sm:{root:{height:"32px",px:"10px"}},md:{root:{height:"38px",px:"12px"}},lg:{root:{height:"44px",px:"14px"}}}},defaultVariants:{size:"md"}});var E=I("<input>");function o(t){const[l,z]=v(t,["size","class"]),y=L({size:l.size});return(()=>{var n=E();return S(n,D({get class(){return`${y.root} ${l.class??""}`}},z),!1,!1),n})()}try{o.displayName="Input",o.__docgenInfo={description:"",displayName:"Input",props:{size:{defaultValue:null,description:"",name:"size",required:!1,type:{name:"enum",value:[{value:"undefined"},{value:'"sm"'},{value:'"md"'},{value:'"lg"'}]}},class:{defaultValue:null,description:"",name:"class",required:!1,type:{name:"string | undefined"}}}}}catch{}const C={title:"Atoms/Input",component:o,argTypes:{size:{control:"select",options:["sm","md","lg"]}}},e={args:{placeholder:"Enter text..."}},r={args:{size:"sm",placeholder:"Small input"}},a={args:{size:"lg",placeholder:"Large input"}},s={args:{placeholder:"Disabled",disabled:!0}};var p,i,d;e.parameters={...e.parameters,docs:{...(p=e.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    placeholder: "Enter text..."
  }
}`,...(d=(i=e.parameters)==null?void 0:i.docs)==null?void 0:d.source}}};var c,m,u;r.parameters={...r.parameters,docs:{...(c=r.parameters)==null?void 0:c.docs,source:{originalSource:`{
  args: {
    size: "sm",
    placeholder: "Small input"
  }
}`,...(u=(m=r.parameters)==null?void 0:m.docs)==null?void 0:u.source}}};var g,f,h;a.parameters={...a.parameters,docs:{...(g=a.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    size: "lg",
    placeholder: "Large input"
  }
}`,...(h=(f=a.parameters)==null?void 0:f.docs)==null?void 0:h.source}}};var b,x,_;s.parameters={...s.parameters,docs:{...(b=s.parameters)==null?void 0:b.docs,source:{originalSource:`{
  args: {
    placeholder: "Disabled",
    disabled: true
  }
}`,...(_=(x=s.parameters)==null?void 0:x.docs)==null?void 0:_.source}}};const N=["Default","Small","Large","Disabled"];export{e as Default,s as Disabled,a as Large,r as Small,N as __namedExportsOrder,C as default};

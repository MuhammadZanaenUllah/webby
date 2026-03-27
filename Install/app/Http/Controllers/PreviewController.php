<?php

namespace App\Http\Controllers;

use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class PreviewController extends Controller
{
    /**
     * Serve preview files for a project.
     */
    public function serve(Request $request, Project $project, string $path = 'index.html'): Response
    {
        // Check authorization
        $this->authorize('view', $project);

        // Clean and validate the path
        $path = ltrim($path, '/');
        if (empty($path)) {
            $path = 'index.html';
        }

        // Prevent directory traversal
        if (str_contains($path, '..')) {
            abort(403, 'Invalid path');
        }

        $previewPath = "previews/{$project->id}/{$path}";

        // Check if the file exists
        if (! Storage::disk('local')->exists($previewPath)) {
            // Try index.html for directory requests
            if (! str_contains($path, '.')) {
                $indexPath = "previews/{$project->id}/{$path}/index.html";
                if (Storage::disk('local')->exists($indexPath)) {
                    $previewPath = $indexPath;
                } else {
                    // SPA fallback: serve root index.html for client-side routing
                    // This allows React Router to handle routes like /login, /signup, etc.
                    $spaFallbackPath = "previews/{$project->id}/index.html";
                    if (Storage::disk('local')->exists($spaFallbackPath)) {
                        $previewPath = $spaFallbackPath;
                    } else {
                        abort(404, 'Preview file not found');
                    }
                }
            } else {
                abort(404, 'Preview file not found');
            }
        }

        $fullPath = Storage::disk('local')->path($previewPath);
        $mimeType = $this->getMimeType($path);

        // For HTML files, inject inspector script on-the-fly
        if (str_ends_with($path, '.html') || str_ends_with($path, '.htm')) {
            $html = file_get_contents($fullPath);
            $html = $this->injectInspectorScript($html);

            return response($html, 200, [
                'Content-Type' => $mimeType,
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0',
            ]);
        }

        return response()->file($fullPath, [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    /**
     * Get MIME type based on file extension.
     */
    protected function getMimeType(string $path): string
    {
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        $mimeTypes = [
            'html' => 'text/html',
            'htm' => 'text/html',
            'css' => 'text/css',
            'js' => 'application/javascript',
            'mjs' => 'application/javascript',
            'json' => 'application/json',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            'ico' => 'image/x-icon',
            'webp' => 'image/webp',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
            'ttf' => 'font/ttf',
            'eot' => 'application/vnd.ms-fontobject',
            'otf' => 'font/otf',
            'txt' => 'text/plain',
            'xml' => 'application/xml',
            'pdf' => 'application/pdf',
            'map' => 'application/json',
        ];

        return $mimeTypes[$extension] ?? 'application/octet-stream';
    }

    /**
     * Inject the inspector script into HTML content.
     */
    protected function injectInspectorScript(string $html): string
    {
        $script = $this->getInspectorScript();

        return str_replace('</body>', "<script id=\"preview-inspector\">{$script}</script>\n</body>", $html);
    }

    /**
     * Get the preview inspector script for element selection, inline editing, and theme sync.
     */
    protected function getInspectorScript(): string
    {
        return <<<'JS'
(function(){
'use strict';
var mode='preview',highlightOverlay=null,tagTooltip=null,currentHoveredElement=null,editingElement=null,editFloatingButtons=null,originalTextContent='',translations={Save:'Save',Cancel:'Cancel'};
function generateId(){return'el-'+Date.now()+'-'+Math.random().toString(36).substr(2,9)}
function getXPath(element){if(element.id)return'//*[@id="'+element.id+'"]';var parts=[],current=element;while(current&&current.nodeType===Node.ELEMENT_NODE){var index=1,sibling=current.previousElementSibling;while(sibling){if(sibling.nodeName===current.nodeName)index++;sibling=sibling.previousElementSibling}var tagName=current.nodeName.toLowerCase(),part=index>1?tagName+'['+index+']':tagName;parts.unshift(part);current=current.parentElement}return'/'+parts.join('/')}
function getCssSelector(element){if(element.id)return'#'+CSS.escape(element.id);var parts=[],current=element;while(current&&current.nodeType===Node.ELEMENT_NODE&&current!==document.body){var selector=current.tagName.toLowerCase(),classes=Array.from(current.classList).filter(function(c){return!c.startsWith('inspector-')&&!c.startsWith('preview-inspector-')&&c.length<30});if(classes.length>0)selector+='.'+CSS.escape(classes[0]);var siblings=current.parentElement?current.parentElement.querySelectorAll(':scope > '+selector):null;if(siblings&&siblings.length>1){var index=Array.from(siblings).indexOf(current)+1;selector+=':nth-of-type('+index+')'}parts.unshift(selector);var fullSelector=parts.join(' > ');if(document.querySelectorAll(fullSelector).length===1)return fullSelector;current=current.parentElement}return parts.join(' > ')}
function getTextPreview(element){var text=(element.textContent||'').trim();return text.length>50?text.substring(0,50)+'...':text}
function getEditableAttributes(element){var attrs={},tagName=element.tagName.toLowerCase(),attrMap={a:['href','title'],img:['src','alt','title'],input:['placeholder','title'],textarea:['placeholder','title'],button:['title']},editableAttrs=attrMap[tagName]||[];for(var i=0;i<editableAttrs.length;i++){var attr=editableAttrs[i],value=element.getAttribute(attr);if(value!==null)attrs[attr]=value}return attrs}
function serializeElement(element){var rect=element.getBoundingClientRect();return{id:generateId(),tagName:element.tagName.toLowerCase(),elementId:element.id||null,classNames:Array.from(element.classList),textPreview:getTextPreview(element),xpath:getXPath(element),cssSelector:getCssSelector(element),boundingRect:{top:rect.top,left:rect.left,width:rect.width,height:rect.height},attributes:getEditableAttributes(element),parentTagName:element.parentElement?element.parentElement.tagName.toLowerCase():null}}
function shouldIgnoreElement(element){var ignoredTags=['script','style','link','meta','head','html'],tagName=element.tagName.toLowerCase();if(ignoredTags.indexOf(tagName)!==-1)return true;if(element.id==='preview-inspector')return true;if(element.hasAttribute('data-preview-inspector'))return true;if(element.closest('[data-preview-inspector]'))return true;return false}
function isTextEditable(element){var editableTags=['h1','h2','h3','h4','h5','h6','p','span','label','li','a','button','td','th'];return editableTags.indexOf(element.tagName.toLowerCase())!==-1}
function createHighlightOverlay(){var overlay=document.createElement('div');overlay.setAttribute('data-preview-inspector','highlight');overlay.style.cssText='position:fixed;pointer-events:none;border:2px solid hsl(221.2 83.2% 53.3%);background:hsla(221.2,83.2%,53.3%,0.1);z-index:999999;transition:all 0.1s ease;display:none;border-radius:4px;';document.body.appendChild(overlay);return overlay}
function createTagTooltip(){var tooltip=document.createElement('div');tooltip.setAttribute('data-preview-inspector','tooltip');tooltip.style.cssText='position:fixed;background:hsl(240 5.9% 10%);color:hsl(0 0% 98%);padding:4px 10px;border-radius:6px;font-size:11px;font-family:ui-monospace,SFMono-Regular,monospace;z-index:1000000;pointer-events:none;display:none;white-space:nowrap;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);';document.body.appendChild(tooltip);return tooltip}
function createEditFloatingButtons(){var container=document.createElement('div');container.setAttribute('data-preview-inspector','edit-buttons');container.style.cssText='position:fixed;display:none;gap:6px;z-index:1000001;font-family:system-ui,-apple-system,sans-serif;background:hsl(0 0% 100%);border:1px solid hsl(240 5.9% 90%);border-radius:8px;padding:6px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -2px rgba(0,0,0,0.1);';var saveBtn=document.createElement('button');saveBtn.textContent=translations.Save;saveBtn.style.cssText='padding:6px 12px;background:hsl(240 5.9% 10%);color:hsl(0 0% 98%);border:none;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;transition:opacity 0.15s;';saveBtn.onmouseenter=function(){this.style.opacity='0.9'};saveBtn.onmouseleave=function(){this.style.opacity='1'};saveBtn.onclick=handleSaveEdit;var cancelBtn=document.createElement('button');cancelBtn.textContent=translations.Cancel;cancelBtn.style.cssText='padding:6px 12px;background:transparent;color:hsl(240 5.9% 10%);border:1px solid hsl(240 5.9% 90%);border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;transition:background 0.15s;';cancelBtn.onmouseenter=function(){this.style.background='hsl(240 5.9% 96%)'};cancelBtn.onmouseleave=function(){this.style.background='transparent'};cancelBtn.onclick=handleCancelEdit;container.appendChild(saveBtn);container.appendChild(cancelBtn);document.body.appendChild(container);return container}
function updateHighlight(element){if(!highlightOverlay||!tagTooltip)return;if(!element||mode==='preview'){highlightOverlay.style.display='none';tagTooltip.style.display='none';return}var rect=element.getBoundingClientRect();highlightOverlay.style.display='block';highlightOverlay.style.top=rect.top+'px';highlightOverlay.style.left=rect.left+'px';highlightOverlay.style.width=rect.width+'px';highlightOverlay.style.height=rect.height+'px';highlightOverlay.style.borderColor='#3b82f6';highlightOverlay.style.borderStyle='solid';highlightOverlay.style.background='rgba(59,130,246,0.1)';var tagName=element.tagName.toLowerCase(),id=element.id?'#'+element.id:'',className=element.classList.length>0?'.'+element.classList[0]:'';tagTooltip.textContent='<'+tagName+id+className+'>';tagTooltip.style.display='block';tagTooltip.style.top=Math.max(0,rect.top-24)+'px';tagTooltip.style.left=rect.left+'px'}
function positionEditButtons(element){if(!editFloatingButtons)return;var rect=element.getBoundingClientRect();editFloatingButtons.style.display='flex';editFloatingButtons.style.top=(rect.bottom+4)+'px';editFloatingButtons.style.left=rect.left+'px'}
function hideEditButtons(){if(editFloatingButtons)editFloatingButtons.style.display='none'}
function updateButtonTranslations(){if(!editFloatingButtons)return;var buttons=editFloatingButtons.querySelectorAll('button');if(buttons.length>=2){buttons[0].textContent=translations.Save;buttons[1].textContent=translations.Cancel}}
function handleMouseMove(e){if(mode==='preview')return;if(editingElement){updateHighlight(null);return}var target=e.target;if(shouldIgnoreElement(target)){updateHighlight(null);return}if(target!==currentHoveredElement){currentHoveredElement=target;updateHighlight(target);window.parent.postMessage({type:'inspector-element-hover',element:serializeElement(target)},'*')}}
function handleMouseLeave(){currentHoveredElement=null;updateHighlight(null);window.parent.postMessage({type:'inspector-element-hover',element:null},'*')}
function handleClick(e){if(mode==='preview')return;var target=e.target;if(shouldIgnoreElement(target))return;if(editingElement){if(editingElement.contains(target))return;handleCancelEdit()}e.preventDefault();e.stopPropagation();window.parent.postMessage({type:'inspector-element-click',element:serializeElement(target),position:{x:e.clientX,y:e.clientY}},'*')}
function handleDoubleClick(e){if(mode!=='inspect')return;var target=e.target;if(shouldIgnoreElement(target))return;if(editingElement){if(editingElement.contains(target))return;handleCancelEdit()}if(!isTextEditable(target))return;e.preventDefault();e.stopPropagation();startEditing(target)}
function startEditing(element){if(editingElement)handleCancelEdit();editingElement=element;originalTextContent=element.textContent||'';element.setAttribute('contenteditable','true');element.style.outline='2px solid #22c55e';element.style.outlineOffset='2px';element.focus();var range=document.createRange();range.selectNodeContents(element);var selection=window.getSelection();if(selection){selection.removeAllRanges();selection.addRange(range)}positionEditButtons(element)}
function handleSaveEdit(){if(!editingElement)return;var newValue=editingElement.textContent||'',elementData=serializeElement(editingElement),edit={id:generateId(),element:elementData,field:'text',originalValue:originalTextContent,newValue:newValue,timestamp:new Date()};window.parent.postMessage({type:'inspector-element-edited',edit:edit},'*');finishEditing()}
function handleCancelEdit(){if(!editingElement)return;editingElement.textContent=originalTextContent;window.parent.postMessage({type:'inspector-edit-cancelled',elementId:editingElement.id||getCssSelector(editingElement)},'*');finishEditing()}
function finishEditing(){if(editingElement){editingElement.removeAttribute('contenteditable');editingElement.style.outline='';editingElement.style.outlineOffset='';editingElement.blur()}var sel=window.getSelection();if(sel)sel.removeAllRanges();editingElement=null;originalTextContent='';currentHoveredElement=null;hideEditButtons()}
function handleKeyDown(e){if(!editingElement)return;if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSaveEdit()}else if(e.key==='Escape'){e.preventDefault();handleCancelEdit()}}
function handleMessage(e){var data=e.data;if(!data||!data.type||data.type.indexOf('inspector-')!==0)return;if(data.type==='inspector-set-mode')setMode(data.mode);else if(data.type==='inspector-highlight-element')highlightBySelector(data.selector);else if(data.type==='inspector-clear-highlights')updateHighlight(null);else if(data.type==='inspector-edit-element'){var el=document.querySelector(data.selector);if(el){startEditing(el)}}else if(data.type==='inspector-revert-edits'&&data.edits&&Array.isArray(data.edits)){revertEdits(data.edits)}else if(data.type==='inspector-set-theme'){if(data.theme==='dark'){document.documentElement.classList.add('dark');if(window.__THEME_DARK__)applyThemeVars(window.__THEME_DARK__)}else{document.documentElement.classList.remove('dark');if(window.__THEME_LIGHT__)applyThemeVars(window.__THEME_LIGHT__)}}else if(data.type==='inspector-apply-theme'){window.__THEME_LIGHT__=data.light;window.__THEME_DARK__=data.dark;var isDark=document.documentElement.classList.contains('dark');applyThemeVars(isDark?data.dark:data.light)}else if(data.type==='inspector-set-translations'&&data.translations){translations=Object.assign({},translations,data.translations);updateButtonTranslations()}else if(data.type==='inspector-get-classes'&&data.selector){handleGetClasses(data.selector)}else if(data.type==='inspector-update-classes'&&data.selector){handleUpdateClasses(data.selector,data.add,data.remove)}else if(data.type==='inspector-preview-class'&&data.selector){handlePreviewClass(data.selector,data.addClass,data.removeClass)}else if(data.type==='inspector-set-breakpoint'){activeBreakpoint=data.breakpoint||''}}
function setMode(newMode){mode=newMode;if(mode==='preview'){updateHighlight(null);hideEditButtons();if(editingElement)handleCancelEdit()}}
function highlightBySelector(selector){try{var element=document.querySelector(selector);if(element)updateHighlight(element)}catch(e){console.warn('Invalid selector:',selector)}}
function revertEdits(edits){for(var i=0;i<edits.length;i++){try{var edit=edits[i],el=document.querySelector(edit.selector);if(!el)continue;if(edit.field==='text')el.textContent=edit.originalValue;else el.setAttribute(edit.field,edit.originalValue)}catch(e){console.warn('Failed to revert edit for selector:',edit.selector)}}}
function applyThemeVars(vars){var root=document.documentElement;for(var key in vars){if(vars.hasOwnProperty(key))root.style.setProperty('--'+key,vars[key])}}
var activeBreakpoint='',jitCache=new Set(),jitStyleEl=null;function getJitStyle(){if(!jitStyleEl){jitStyleEl=document.createElement('style');jitStyleEl.id='webby-jit-css';jitStyleEl.setAttribute('data-preview-inspector','jit');document.head.appendChild(jitStyleEl)}return jitStyleEl}
var SP={'0':'0px','0.5':'0.125rem','1':'0.25rem','1.5':'0.375rem','2':'0.5rem','2.5':'0.625rem','3':'0.75rem','3.5':'0.875rem','4':'1rem','5':'1.25rem','6':'1.5rem','7':'1.75rem','8':'2rem','9':'2.25rem','10':'2.5rem','11':'2.75rem','12':'3rem','14':'3.5rem','16':'4rem','20':'5rem','24':'6rem','28':'7rem','32':'8rem','36':'9rem','40':'10rem','44':'11rem','48':'12rem','52':'13rem','56':'14rem','60':'15rem','64':'16rem','72':'18rem','80':'20rem','96':'24rem','px':'1px','auto':'auto'};
var FS={xs:['0.75rem','1rem'],sm:['0.875rem','1.25rem'],base:['1rem','1.5rem'],lg:['1.125rem','1.75rem'],xl:['1.25rem','1.75rem'],'2xl':['1.5rem','2rem'],'3xl':['1.875rem','2.25rem'],'4xl':['2.25rem','2.5rem'],'5xl':['3rem','1'],'6xl':['3.75rem','1'],'7xl':['4.5rem','1'],'8xl':['6rem','1'],'9xl':['8rem','1']};
var FW={thin:'100',extralight:'200',light:'300',normal:'400',medium:'500',semibold:'600',bold:'700',extrabold:'800',black:'900'};
var BR={none:'0px',sm:'0.125rem','':'0.25rem',md:'0.375rem',lg:'0.5rem',xl:'0.75rem','2xl':'1rem','3xl':'1.5rem',full:'9999px'};
var SH={sm:'0 1px 2px 0 rgb(0 0 0/0.05)','':'0 1px 3px 0 rgb(0 0 0/0.1),0 1px 2px -1px rgb(0 0 0/0.1)',md:'0 4px 6px -1px rgb(0 0 0/0.1),0 2px 4px -2px rgb(0 0 0/0.1)',lg:'0 10px 15px -3px rgb(0 0 0/0.1),0 4px 6px -4px rgb(0 0 0/0.1)',xl:'0 20px 25px -5px rgb(0 0 0/0.1),0 8px 10px -6px rgb(0 0 0/0.1)','2xl':'0 25px 50px -12px rgb(0 0 0/0.25)',inner:'inset 0 2px 4px 0 rgb(0 0 0/0.05)',none:'0 0 #0000'};
var CO={slate:{50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155',800:'#1e293b',900:'#0f172a',950:'#020617'},gray:{50:'#f9fafb',100:'#f3f4f6',200:'#e5e7eb',300:'#d1d5db',400:'#9ca3af',500:'#6b7280',600:'#4b5563',700:'#374151',800:'#1f2937',900:'#111827',950:'#030712'},zinc:{50:'#fafafa',100:'#f4f4f5',200:'#e4e4e7',300:'#d4d4d8',400:'#a1a1aa',500:'#71717a',600:'#52525b',700:'#3f3f46',800:'#27272a',900:'#18181b',950:'#09090b'},red:{50:'#fef2f2',100:'#fee2e2',200:'#fecaca',300:'#fca5a5',400:'#f87171',500:'#ef4444',600:'#dc2626',700:'#b91c1c',800:'#991b1b',900:'#7f1d1d',950:'#450a0a'},orange:{50:'#fff7ed',100:'#ffedd5',200:'#fed7aa',300:'#fdba74',400:'#fb923c',500:'#f97316',600:'#ea580c',700:'#c2410c',800:'#9a3412',900:'#7c2d12',950:'#431407'},amber:{50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f',950:'#451a03'},yellow:{50:'#fefce8',100:'#fef9c3',200:'#fef08a',300:'#fde047',400:'#facc15',500:'#eab308',600:'#ca8a04',700:'#a16207',800:'#854d0e',900:'#713f12',950:'#422006'},green:{50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d',950:'#052e16'},teal:{50:'#f0fdfa',100:'#ccfbf1',200:'#99f6e4',300:'#5eead4',400:'#2dd4bf',500:'#14b8a6',600:'#0d9488',700:'#0f766e',800:'#115e59',900:'#134e4a',950:'#042f2e'},cyan:{50:'#ecfeff',100:'#cffafe',200:'#a5f3fc',300:'#67e8f9',400:'#22d3ee',500:'#06b6d4',600:'#0891b2',700:'#0e7490',800:'#155e75',900:'#164e63',950:'#083344'},sky:{50:'#f0f9ff',100:'#e0f2fe',200:'#bae6fd',300:'#7dd3fc',400:'#38bdf8',500:'#0ea5e9',600:'#0284c7',700:'#0369a1',800:'#075985',900:'#0c4a6e',950:'#082f49'},blue:{50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a',950:'#172554'},indigo:{50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81',950:'#1e1b4b'},violet:{50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',600:'#7c3aed',700:'#6d28d9',800:'#5b21b6',900:'#4c1d95',950:'#2e1065'},purple:{50:'#faf5ff',100:'#f3e8ff',200:'#e9d5ff',300:'#d8b4fe',400:'#c084fc',500:'#a855f7',600:'#9333ea',700:'#7e22ce',800:'#6b21a8',900:'#581c87',950:'#3b0764'},pink:{50:'#fdf2f8',100:'#fce7f3',200:'#fbcfe8',300:'#f9a8d4',400:'#f472b6',500:'#ec4899',600:'#db2777',700:'#be185d',800:'#9d174d',900:'#831843',950:'#500724'},rose:{50:'#fff1f2',100:'#ffe4e6',200:'#fecdd3',300:'#fda4af',400:'#fb7185',500:'#f43f5e',600:'#e11d48',700:'#be123c',800:'#9f1239',900:'#881337',950:'#4c0519'}};
var BPS={sm:640,md:768,lg:1024,xl:1280,'2xl':1536};
function resolveSP(p,ax,v,neg){var val=SP[v];if(!val)return null;var vv=(neg&&val!=='0px'&&val!=='auto')?'-'+val:val;var m={'':p+':'+vv,x:p+'-left:'+vv+';'+p+'-right:'+vv,y:p+'-top:'+vv+';'+p+'-bottom:'+vv,t:p+'-top:'+vv,r:p+'-right:'+vv,b:p+'-bottom:'+vv,l:p+'-left:'+vv};return m[ax]||null}
function resolveClass(c){var m;m=c.match(/^p([xytrbl]?)-(.+)$/);if(m)return resolveSP('padding',m[1],m[2]);m=c.match(/^-?m([xytrbl]?)-(.+)$/);if(m){return SP[m[2]]?resolveSP('margin',m[1],m[2],c.startsWith('-')):null}m=c.match(/^gap-(.+)$/);if(m){var gv=SP[m[1]];if(gv)return'gap:'+gv}m=c.match(/^text-(xs|sm|base|lg|xl|[2-9]xl)$/);if(m){var fs=FS[m[1]];if(fs)return'font-size:'+fs[0]+';line-height:'+fs[1]}m=c.match(/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/);if(m){var fw=FW[m[1]];if(fw)return'font-weight:'+fw}if(c==='font-sans')return'font-family:ui-sans-serif,system-ui,sans-serif';if(c==='font-serif')return'font-family:ui-serif,Georgia,serif';if(c==='font-mono')return'font-family:ui-monospace,monospace';if(c==='text-left')return'text-align:left';if(c==='text-center')return'text-align:center';if(c==='text-right')return'text-align:right';if(c==='text-justify')return'text-align:justify';if(c==='uppercase')return'text-transform:uppercase';if(c==='lowercase')return'text-transform:lowercase';if(c==='capitalize')return'text-transform:capitalize';if(c==='normal-case')return'text-transform:none';if(c==='underline')return'text-decoration-line:underline';if(c==='line-through')return'text-decoration-line:line-through';if(c==='no-underline')return'text-decoration-line:none';m=c.match(/^leading-(.+)$/);if(m){var lh={none:'1',tight:'1.25',snug:'1.375',normal:'1.5',relaxed:'1.625',loose:'2'};if(lh[m[1]])return'line-height:'+lh[m[1]]}m=c.match(/^tracking-(.+)$/);if(m){var ls={tighter:'-0.05em',tight:'-0.025em',normal:'0em',wide:'0.025em',wider:'0.05em',widest:'0.1em'};if(ls[m[1]])return'letter-spacing:'+ls[m[1]]}var props=[['text','color'],['bg','background-color'],['border','border-color']];for(var i=0;i<props.length;i++){m=c.match(new RegExp('^'+props[i][0]+'-(\\w+)-(\\d+)$'));if(m&&CO[m[1]]&&CO[m[1]][m[2]])return props[i][1]+':'+CO[m[1]][m[2]]}if(c==='text-white')return'color:#fff';if(c==='text-black')return'color:#000';if(c==='text-transparent')return'color:transparent';if(c==='bg-white')return'background-color:#fff';if(c==='bg-black')return'background-color:#000';if(c==='bg-transparent')return'background-color:transparent';if(c==='border-white')return'border-color:#fff';if(c==='border-black')return'border-color:#000';if(c==='border-transparent')return'border-color:transparent';var disp={block:'block','inline-block':'inline-block',inline:'inline',flex:'flex','inline-flex':'inline-flex',grid:'grid','inline-grid':'inline-grid',hidden:'none'};if(disp[c])return'display:'+disp[c];if(['static','relative','absolute','fixed','sticky'].indexOf(c)!==-1)return'position:'+c;if(c==='flex-row')return'flex-direction:row';if(c==='flex-col')return'flex-direction:column';m=c.match(/^justify-(.+)$/);if(m){var jm={start:'flex-start',end:'flex-end',center:'center',between:'space-between',around:'space-around',evenly:'space-evenly'};if(jm[m[1]])return'justify-content:'+jm[m[1]]}m=c.match(/^items-(.+)$/);if(m){var am={start:'flex-start',end:'flex-end',center:'center',stretch:'stretch',baseline:'baseline'};if(am[m[1]])return'align-items:'+am[m[1]]}m=c.match(/^grid-cols-(\d+)$/);if(m)return'grid-template-columns:repeat('+m[1]+',minmax(0,1fr))';if(c==='flex-row-reverse')return'flex-direction:row-reverse';if(c==='flex-col-reverse')return'flex-direction:column-reverse';m=c.match(/^border(?:-([trbl]))?(?:-(\d+))?$/);if(m!==null&&c.startsWith('border')&&c.indexOf('color')===-1&&c.indexOf('radius')===-1&&c.indexOf('collapse')===-1){var bside=m[1]?{t:'top',r:'right',b:'bottom',l:'left'}[m[1]]:'';var bw=m[2]||'1';return(bside?'border-'+bside+'-width':'border-width')+':'+bw+'px'}for(var bsi=0,bss=['solid','dashed','dotted','double','none'];bsi<bss.length;bsi++){if(c==='border-'+bss[bsi])return'border-style:'+bss[bsi]}m=c.match(/^rounded(?:-(.+))?$/);if(m!==null&&c.startsWith('rounded')){var rv=BR[m[1]||''];if(rv)return'border-radius:'+rv}m=c.match(/^shadow(?:-(.+))?$/);if(m!==null&&c.startsWith('shadow')){var sv=SH[m[1]||''];if(sv!==undefined)return'box-shadow:'+sv}m=c.match(/^opacity-(\d+)$/);if(m)return'opacity:'+(parseInt(m[1])/100);return null}
function classToCSS(cn){var bp='',cl=cn;var bpList=['sm:','md:','lg:','xl:','2xl:'];for(var i=0;i<bpList.length;i++){if(cn.indexOf(bpList[i])===0){bp=bpList[i].slice(0,-1);cl=cn.slice(bpList[i].length);break}}var esc=cn.replace(/[.:\/\[\]%#(),!]/g,'\\$&');var css=resolveClass(cl);if(!css)return null;var rule='.'+esc+'{'+css+'}';if(bp&&BPS[bp])rule='@media(min-width:'+BPS[bp]+'px){'+rule+'}';return rule}
function injectJIT(cn){if(jitCache.has(cn))return;var css=classToCSS(cn);if(css){getJitStyle().textContent+=css+'\n';jitCache.add(cn)}}
function handleGetClasses(sel){try{var el=document.querySelector(sel);if(!el)return;var cs=window.getComputedStyle(el);window.parent.postMessage({type:'inspector-classes-response',selector:sel,classes:Array.from(el.classList),computedStyle:{fontSize:cs.fontSize,fontWeight:cs.fontWeight,fontFamily:cs.fontFamily,textAlign:cs.textAlign,lineHeight:cs.lineHeight,letterSpacing:cs.letterSpacing,color:cs.color,backgroundColor:cs.backgroundColor,borderColor:cs.borderColor,borderWidth:cs.borderWidth,borderRadius:cs.borderRadius,padding:cs.padding,margin:cs.margin,display:cs.display,position:cs.position,opacity:cs.opacity,boxShadow:cs.boxShadow}},'*')}catch(e){}}
function handleUpdateClasses(sel,add,rem){try{var el=document.querySelector(sel);if(!el)return;if(rem)for(var i=0;i<rem.length;i++)el.classList.remove(rem[i]);if(add)for(var j=0;j<add.length;j++){injectJIT(add[j]);el.classList.add(add[j])}window.parent.postMessage({type:'inspector-classes-updated',selector:sel,classes:Array.from(el.classList)},'*')}catch(e){}}
function handlePreviewClass(sel,ac,rc){try{var el=document.querySelector(sel);if(!el)return;if(rc)el.classList.remove(rc);if(ac){injectJIT(ac);el.classList.add(ac)}}catch(e){}}
function init(){highlightOverlay=createHighlightOverlay();tagTooltip=createTagTooltip();editFloatingButtons=createEditFloatingButtons();document.addEventListener('mousemove',handleMouseMove,{passive:true});document.addEventListener('mouseleave',handleMouseLeave);document.addEventListener('click',handleClick,true);document.addEventListener('dblclick',handleDoubleClick,true);document.addEventListener('keydown',handleKeyDown);window.addEventListener('message',handleMessage);window.parent.postMessage({type:'inspector-ready'},'*')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
JS;
    }

    /**
     * Check if preview exists for a project.
     */
    public function exists(Request $request, Project $project): Response
    {
        $this->authorize('view', $project);

        $previewPath = "previews/{$project->id}";
        $exists = Storage::disk('local')->exists($previewPath);

        return response()->json([
            'exists' => $exists,
            'url' => $exists ? route('preview.serve', ['project' => $project->id]) : null,
        ]);
    }
}

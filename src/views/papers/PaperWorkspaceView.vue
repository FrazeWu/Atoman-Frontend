<template>
  <main class="papers-workspace" :class="{ 'papers-workspace--compact': compactLayout, 'papers-workspace--rail': desktopRail, 'papers-workspace--focus': focusMode }">
    <header class="papers-workspace__header">
      <RouterLink to="/papers" class="papers-workspace__back" title="返回我的论文" aria-label="返回我的论文"><ArrowLeft :size="16" aria-hidden="true"/><span>我的论文</span></RouterLink>
      <div class="papers-workspace__project-title"><strong :title="project?.name">{{ project?.name || '论文工作台' }}</strong><span v-if="project" class="papers-workspace__project-meta">v{{project.head_revision}} · {{roleLabel}}</span></div>
      <div class="papers-workspace__layout-tools">
        <PButton size="sm" variant="ghost" type="button" class="papers-workspace__quick-button" aria-label="快速打开文件" title="快速打开文件 (Ctrl/Cmd+P)" :disabled="!canSwitchWorkspaceFile" @click="openQuick"><Search :size="15" aria-hidden="true" /></PButton>
        <PButton v-if="!compactLayout" size="sm" variant="ghost" type="button" class="papers-workspace__focus-button" :aria-label="focusMode?'退出专注模式':'专注模式'" :title="focusMode?'退出专注模式':'专注模式'" :aria-pressed="focusMode" :disabled="!focusMode&&(auxiliaryOpen||collaborationOpen||!project||loading||!!error)" @click="toggleFocus"><Maximize2 v-if="!focusMode" :size="15" aria-hidden="true" /><Minimize2 v-else :size="15" aria-hidden="true" /></PButton>
        <PButton class="papers-workspace__layout-switch" aria-label="文件栏" size="sm" variant="secondary" type="button" title="显示或隐藏文件栏" :aria-pressed="showFiles" @click="toggleFilePane"><PanelLeft :size="15" aria-hidden="true"/><span class="papers-workspace__action-label">文件栏</span></PButton>
        <PButton class="papers-workspace__layout-switch" aria-label="分栏" title="同时显示源码与 PDF" size="sm" variant="secondary" type="button" :aria-pressed="layoutMode === 'split'&&!sideToolOpen" v-if="!compactLayout" @click="setWorkspaceLayout('split')"><Columns2 :size="15" aria-hidden="true"/><span class="papers-workspace__action-label">分栏</span></PButton>
        <PButton class="papers-workspace__layout-switch" aria-label="源码" title="仅显示源码" size="sm" variant="secondary" type="button" :aria-pressed="layoutMode === 'editor'&&!sideToolOpen" @click="setWorkspaceLayout('editor')"><FileCode :size="15" aria-hidden="true"/><span class="papers-workspace__action-label">源码</span></PButton>
        <PButton class="papers-workspace__layout-switch" aria-label="预览" title="仅显示 PDF 预览" size="sm" variant="secondary" type="button" :aria-pressed="layoutMode === 'pdf'&&!sideToolOpen" @click="setWorkspaceLayout('pdf')"><FileOutput :size="15" aria-hidden="true"/><span class="papers-workspace__action-label">预览</span></PButton>
        <PButton v-if="ownerAccess&&(sideToolOpen||layoutMode==='editor')" type="button" size="sm" :disabled="!compileEnabled||compiling||saving||switchingFile||navigating||uploadBusy||snapshotMutating||memberMutating||hasActiveCompile||!project||aiRepairActive||aiApplying||(collaborationOpen&&collaborationRevision===null)" @click="compileAndShowPDF">{{hasActiveCompile?'编译中':'编译'}}</PButton>
      </div>

      <span class="papers-workspace__status papers-workspace__save-state" role="status" :title="saveStatus"><span class="papers-workspace__save-dot" :class="{saved:saveStatus==='已保存'}" aria-hidden="true"></span>{{ saveStatus }}</span>
      <div class="papers-workspace__header-actions"><PButton v-if="ownerAccess" type="button" size="sm" :disabled="collaborationOpen||memberMutating||snapshotMutating" @click="toggleTool('members')">分享</PButton>
      <PButton v-if="ownerAccess" type="button" size="sm" variant="secondary" :disabled="collaborationOpen || exporting || saving" class="papers-workspace__export" :aria-label="exporting?'正在导出…':'导出 ZIP'" title="导出 ZIP" @click="exportProject"><Download :size="15" aria-hidden="true"/><span class="papers-workspace__action-label">{{ exporting ? '正在导出…' : '导出 ZIP' }}</span></PButton></div>
    </header>
        <nav v-if="project&&!loading&&!error&&!collaborationOpen&&!focusMode" class="papers-workspace__toolnav" aria-label="项目工具"><div class="papers-workspace__toolgroup" aria-label="写作工具">
          <PButton size="sm" variant="secondary" v-if="ownerAccess" type="button" :disabled="activeFile?.kind!=='text'" :aria-pressed="toolMode==='ai'" @click="toggleTool('ai')" aria-label="AI 助手" title="AI 助手"><Sparkles :size="14" aria-hidden="true" /> AI 助手</PButton>
          <PButton size="sm" variant="secondary" type="button" :aria-pressed="toolMode==='search'" @click="toggleTool('search')" aria-label="全项目搜索" title="全项目搜索"><Search :size="14" aria-hidden="true" /> 全项目搜索</PButton>
          <PButton size="sm" variant="secondary" type="button" :aria-pressed="toolMode==='references'" @click="toggleTool('references')" aria-label="参考文献" title="参考文献"><BookOpen :size="14" aria-hidden="true" /> 参考文献</PButton>
          <PButton size="sm" variant="secondary" v-if="ownerAccess" type="button" :aria-pressed="toolMode==='figures'" @click="toggleTool('figures')" aria-label="插图" title="插图"><ImageIcon :size="14" aria-hidden="true" /> 插图</PButton>
        </div><PButton v-if="compactLayout" size="sm" variant="ghost" type="button" class="papers-workspace__more-tools" :aria-expanded="moreToolsOpen" @click="moreToolsOpen=!moreToolsOpen">更多 <ChevronDown :size="14" aria-hidden="true" /></PButton><div v-show="!compactLayout||moreToolsOpen" class="papers-workspace__toolgroup papers-workspace__secondary-tools" aria-label="版本与投稿">
          <PButton size="sm" variant="secondary" v-if="ownerAccess" type="button" :disabled="activeFile?.kind!=='text'" :aria-pressed="toolMode==='history'" @click="toggleTool('history')" aria-label="版本历史" title="版本历史"><History :size="14" aria-hidden="true" /> 版本历史</PButton>
          <PButton size="sm" variant="secondary" v-if="ownerAccess" type="button" :disabled="snapshotMutating" :aria-pressed="toolMode==='snapshots'" @click="toggleTool('snapshots')" aria-label="项目快照" title="项目快照"><Layers :size="14" aria-hidden="true" /> 项目快照</PButton>
          <PButton size="sm" variant="secondary" v-if="ownerAccess" type="button" :aria-pressed="toolMode==='git'" @click="toggleTool('git')" aria-label="GitHub" title="GitHub"><GitBranch :size="14" aria-hidden="true" /> GitHub</PButton>
          <PButton size="sm" variant="secondary" v-if="ownerAccess" type="button" :aria-pressed="toolMode==='submission'" @click="toggleTool('submission')" aria-label="投稿检查" title="投稿检查"><ClipboardCheck :size="14" aria-hidden="true" /> 投稿检查</PButton>
          <PButton size="sm" variant="secondary" type="button" :disabled="snapshotMutating" :aria-pressed="toolMode==='drafts'" @click="toggleTool('drafts')" :aria-label="'草稿恢复'+(draftRows.length?' ('+draftRows.length+')':'')" title="草稿恢复"><FileClock :size="14" aria-hidden="true" /> 草稿恢复{{ draftRows.length?' ('+draftRows.length+')':'' }}</PButton>
        </div><div v-show="!compactLayout||moreToolsOpen" class="papers-workspace__toolgroup papers-workspace__secondary-tools" aria-label="项目管理">
          <PButton size="sm" variant="secondary" type="button" :aria-pressed="toolMode==='members'" :disabled="memberMutating||snapshotMutating" @click="toggleTool('members')" aria-label="项目成员" title="项目成员"><Users :size="14" aria-hidden="true" /> 项目成员</PButton>
          <PButton size="sm" variant="secondary" type="button" :disabled="switchingFile||navigating||saving||uploadBusy||snapshotMutating||memberMutating||compiling||hasActiveCompile" @click="refreshServerProject" aria-label="刷新项目" title="刷新项目"><RefreshCw :size="14" aria-hidden="true" /> 刷新项目</PButton>
        </div></nav>
    <p v-if="loading" class="papers-workspace__message">正在打开项目...</p>
    <p v-else-if="error" role="alert" class="papers-workspace__error">{{ error }}</p>
    <div v-else ref="workspaceRoot" class="papers-workspace__content" :class="{ 'files-hidden': !showFiles, 'editor-only': layoutMode === 'editor', 'pdf-only': layoutMode === 'pdf', 'ai-expanded': aiPanelOpen&&aiExpanded, 'tool-open': sideToolOpen, 'ai-open': aiPanelOpen, 'ai-collapsed': aiPanelOpen&&aiCollapsed }" :style="{ '--preview-grow': previewWidth, '--editor-grow': 100-previewWidth, '--files-width': filesWidth+'px' }">
      <button v-if="compactLayout && showFiles" type="button" class="papers-workspace__files-backdrop" aria-label="关闭文件栏" @click="showFiles=false" />
      <aside class="papers-workspace__files" :class="{'papers-workspace__files--dropping':draggingFiles}" aria-label="论文文件" @dragenter="onFigureDragOver" @dragover="onFigureDragOver" @dragleave="onFigureDragLeave" @drop="onFigureDrop">
        <div class="papers-workspace__files-heading"><h2>项目文件 <small>{{ files.length }}</small></h2><div v-if="ownerAccess&&!collaborationOpen" class="papers-workspace__file-actions">
          <PButton size="sm" variant="secondary" type="button" aria-label="新建文本文件" title="新建文本文件" :aria-expanded="fileAction==='create'" @click="fileAction=fileAction==='create'?'':'create';managedFile=null"><Plus :size="14" aria-hidden="true" /><span class="papers-workspace__sr">新建</span></PButton>
          <PButton size="sm" variant="secondary" type="button" aria-label="上传文件" title="上传文件" :aria-expanded="fileAction==='upload'" @click="fileAction=fileAction==='upload'?'':'upload';managedFile=null"><Upload :size="14" aria-hidden="true" /><span class="papers-workspace__sr">上传</span></PButton>
        </div><PButton size="sm" variant="secondary" type="button" class="papers-workspace__close-files" aria-label="关闭文件面板" @click="showFiles=false"><PanelLeftClose :size="15" aria-hidden="true" /></PButton></div>
        <div class="papers-workspace__files-toolbar">
          <PInput v-model.trim="fileFilter" aria-label="筛选项目文件" placeholder="搜索文件…" />
          <PButton size="sm" variant="secondary" v-if="fileFilter" type="button" aria-label="清空文件筛选" @click="fileFilter=''">×</PButton>
        </div>
        <div class="papers-workspace__tree" aria-label="文件列表">
        <p v-if="!visibleTreeRows.length" class="papers-workspace__tree-empty">没有匹配的文件</p>
        <div v-for="entry in visibleTreeRows" :key="entry.key" class="papers-workspace__file-row" :style="{paddingLeft:Math.min(entry.depth,8)*10+'px'}">
          <PButton size="sm" variant="ghost" v-if="entry.kind==='folder'" type="button" class="papers-workspace__folder" :aria-expanded="!!fileFilter||!closedFolders.has(entry.path)" :disabled="!!fileFilter" @click="toggleFolder(entry.path)"><ChevronRight v-if="!fileFilter&&closedFolders.has(entry.path)" :size="12" aria-hidden="true" /><ChevronDown v-else :size="12" aria-hidden="true" /><Folder v-if="!fileFilter&&closedFolders.has(entry.path)" :size="14" aria-hidden="true" /><FolderOpen v-else :size="14" aria-hidden="true" /><span class="papers-workspace__filename">{{ entry.name }}</span></PButton>
          <template v-else>
            <PButton size="sm" variant="ghost" type="button" :title="entry.path" :class="{active:activeFile?.id===entry.file.id}" :disabled="!canChooseTreeFile" @click="selectTreeFile(entry.file)"><ImageIcon v-if="entry.file.kind==='binary'" :size="14" aria-hidden="true" /><FileCode2 v-else-if="/\.(tex|bib|cls|sty|bst)$/i.test(entry.path)" :size="14" aria-hidden="true" /><FileText v-else :size="14" aria-hidden="true" /><span class="papers-workspace__filename">{{ entry.name }}</span><span v-if="entry.file.id===project?.main_file_id" class="papers-workspace__asset-label">主文件</span><span v-else-if="entry.file.kind==='binary'" class="papers-workspace__asset-label">资源</span></PButton>
            <PButton size="sm" variant="ghost" v-if="ownerAccess&&!collaborationOpen" type="button" class="papers-workspace__file-menu" :aria-label="'管理 '+entry.path" :disabled="uploadBusy||navigating||switchingFile" @click="openFileMenu(entry.file)">⋯</PButton>
          </template>
        </div>
        </div>
        <div v-if="ownerAccess&&!collaborationOpen&&managedFile" class="papers-workspace__manage">
          <strong>{{ managedFile.path }}</strong>
          <label>新路径<PInput v-model.trim="managedPath" maxlength="512" aria-label="文件新路径" /></label>
          <PButton size="sm" variant="secondary" :disabled="uploadBusy||!managedPath||managedPath===managedFile.path" @click="changeFile('rename')">重命名 / 移动</PButton>
          <PButton v-if="managedFile.kind==='text'&&/^[^/]+\.tex$/i.test(managedFile.path)&&managedFile.id!==project?.main_file_id" size="sm" variant="secondary" :disabled="uploadBusy" @click="changeFile('set_main')">设为主文件</PButton>
          <PButton v-if="managedFile.id!==project?.main_file_id" size="sm" variant="secondary" :disabled="uploadBusy" @click="changeFile('delete')">删除文件</PButton>
          <PButton size="sm" variant="ghost" :disabled="addingFile" @click="managedFile=null">关闭</PButton>
        </div>
        <div v-if="ownerAccess&&!collaborationOpen" v-show="fileAction==='upload'" class="papers-workspace__manage">
          <label>上传到目录（可选）<PInput v-model.trim="uploadDir" placeholder="figures" maxlength="255" /></label>
          <input ref="uploadInput" type="file" multiple hidden :disabled="uploadBusy" @change="uploadFiles" />
          <PButton size="sm" variant="secondary" :disabled="uploadBusy||switchingFile||navigating" @click="uploadInput?.click()">{{ uploadBusy?'处理中…':'上传文件' }}</PButton>
          <div class="papers-workspace__drop-zone" :class="{'active':draggingFiles}" aria-label="图片拖放上传区域">
            <strong>{{ draggingFiles?'松开鼠标上传插图':'拖放图片至此' }}</strong>
            <small>PNG、JPEG、PDF · {{ uploadDir.trim()||'figures' }}/</small>
          </div>
        </div>
        <form v-if="ownerAccess&&!collaborationOpen" v-show="fileAction==='create'" class="papers-workspace__add" @submit.prevent="addFile">
          <label for="papers-new-file">新建文本文件</label>
          <PInput id="papers-new-file" v-model.trim="newFilePath" placeholder="chapters/intro.tex" maxlength="512" required />
          <PButton type="submit" size="sm" :disabled="!newFilePath || uploadBusy || switchingFile || navigating">添加文件</PButton>
        </form>
        <p v-if="fileError" class="papers-workspace__error" role="alert">{{ fileError }}</p>
      </aside>
      <div v-if="showFiles&&!compactLayout" class="papers-workspace__files-divider" role="separator" aria-label="调整文件栏宽度" aria-orientation="vertical" tabindex="0" :aria-valuenow="filesWidth" title="拖动调整宽度，双击恢复默认" @dblclick="resetPanelWidths" @pointerdown="beginFilesResize" @pointermove="moveFilesResize" @pointerup="endFilesResize" @pointercancel="endFilesResize" @keydown.left.prevent="resizeFiles(filesWidth-16)" @keydown.right.prevent="resizeFiles(filesWidth+16)" />
      <div ref="sourceColumn" class="papers-workspace__editor-column" :style="{'--ai-height':aiHeight+'%'}">
      <section class="papers-workspace__editor" aria-label="源码编辑">
        <nav v-if="openTabs.length" class="papers-workspace__tabs" aria-label="已打开文件">
          <div v-for="file in openTabs" :key="file.id" class="papers-workspace__tab" :class="{active:file.id===activeFile?.id}">
            <PButton type="button" size="sm" variant="ghost" :aria-label="'切换到 '+file.path" :title="'切换到 '+file.path" :aria-current="file.id===activeFile?.id?'page':undefined" :disabled="!canSwitchWorkspaceFile" @click="openWorkspaceFile(file)">
              <FileCode2 v-if="file.kind==='text'" :size="14" aria-hidden="true" /><ImageIcon v-else :size="14" aria-hidden="true" />
              <span>{{file.path.split('/').at(-1)}}</span><span v-if="file.id===activeFile?.id&&file.kind==='text'&&draft!==activeFile?.content" class="papers-workspace__dirty" aria-label="未保存">●</span>
            </PButton>
            <PButton v-if="openTabs.length>1" type="button" size="sm" variant="ghost" class="papers-workspace__tab-close" :aria-label="'关闭标签 '+file.path" :title="'关闭标签 '+file.path" :disabled="!canSwitchWorkspaceFile" @click="closeWorkspaceTab(file)"><X :size="12" aria-hidden="true" /></PButton>
          </div>
          <PButton class="papers-workspace__tab-add" type="button" size="sm" variant="ghost" aria-label="快速查找其他文件" title="快速打开 (Ctrl/Cmd+P)" :disabled="!canSwitchWorkspaceFile" @click="openQuick"><Plus :size="15" aria-hidden="true"/></PButton>
        </nav>
        <div class="papers-workspace__editor-header">
          <span :title="activeFile?.path">{{ activeFile?.path || '请选择文件' }}</span>
          <PButton size="sm" variant="ghost" v-if="!collaborationOpen" type="button" class="papers-workspace__sync papers-workspace__editor-icon" aria-label="大纲" title="项目大纲" :aria-expanded="outlineOpen" @click="toggleOutline"><ListTree :size="15" aria-hidden="true"/><span class="papers-workspace__sr">大纲</span></PButton>
          <PButton size="sm" variant="ghost" type="button" class="papers-workspace__sync papers-workspace__editor-icon" aria-label="定位 PDF" title="定位当前源码行对应的 PDF 内容 (Ctrl/Cmd+Shift+J)" :disabled="!syncReady || activeFile?.kind !== 'text'" @click="jumpToPDF"><ArrowRight :size="15" aria-hidden="true"/><span class="papers-workspace__sr">定位 PDF →</span></PButton>
          <PButton v-if="writeAccess&&!collaborationOpen" type="button" size="sm" variant="secondary" :disabled="!activeFile || activeFile.kind !== 'text' || saving" class="papers-workspace__editor-icon" aria-label="保存" title="保存源码 (Ctrl/Cmd+S)" @click="saveNow"><Save :size="15" aria-hidden="true"/><span class="papers-workspace__sr">保存</span></PButton>
          <PButton v-if="collaborationOpen&&ownerAccess" type="button" size="sm" variant="secondary" :disabled="!aiSharedState?.ready||snapshotMutating||compiling" @click="toggleTool('ai')">AI 助手</PButton>
          <PButton v-if="collaborationOpen&&ownerAccess" type="button" size="sm" variant="secondary" :disabled="snapshotMutating||compiling" @click="toggleTool('snapshots')">项目快照</PButton>
          <PButton v-if="!collaborationOpen&&activeFile?.kind==='text'&&accountId" type="button" size="sm" variant="secondary" :disabled="!canStartCollaboration" :title="collaborationGateMessage || '实时协作'" class="papers-workspace__editor-collab" aria-label="实时协作" @click="startCollaboration"><Users :size="14" aria-hidden="true"/><span>实时协作</span></PButton>
        </div>
        <p v-if="!collaborationOpen&&collaborationScope&&collaborationGateMessage" class="papers-workspace__stale" role="status">{{ collaborationGateMessage }} <PButton size="sm" variant="ghost" v-if="collaborationGate.scope===collaborationScope&&collaborationGate.state==='unavailable'" type="button" class="papers-workspace__sync" :disabled="navigating||switchingFile" @click="checkCollaborationCapability">重新检查</PButton></p>

        <p v-if="!ownerAccess&&!collaborationOpen" class="papers-workspace__stale" role="status">{{ writeAccess?(collaborationGate.state==='available'?'共享编辑：普通保存会检查文件版本；可使用实时协作。':'共享编辑：保存时检查文件版本，暂不支持实时共同编辑。'):'共享阅读：当前账号无编辑权限。' }}</p>
        <p v-if="refreshMessage" class="papers-workspace__stale" role="status">{{ refreshMessage }}</p>


        <PaperCollaborationPanel v-if="collaborationOpen&&activeFile?.kind==='text'&&collaborationAccount===accountId" :key="projectId+':'+activeFile.id+':'+accountId" ref="collaborationRef" :project-id="projectId" :file="activeFile" :role="ownerAccess?'owner':writeAccess?'editor':'viewer'" :account-id="accountId" :citations="citationKeys" :operation-busy="snapshotMutating||compiling" @confirmed="onCollaborationConfirmed" @ai-state="onCollaborationAIState" @exit="exitCollaboration" @unavailable="onCollaborationUnavailable" />
        <LatexEditor v-else-if="!collaborationOpen&&activeFile?.kind === 'text'" :key="activeFile.id" ref="editorRef"  :model-value="draft" @update:model-value="updateDraft" :citations="citationKeys" :readonly="!writeAccess || switchingFile || navigating || addingFile" @show-pdf="jumpToPDF" />
        <PaperAssetPreview v-else-if="activeFile?.kind === 'binary'" :key="activeFile.id+':'+activeFile.revision" :file="activeFile" />
        <p v-else class="papers-workspace__message">在左侧选择一个文件开始编辑。</p>
        <p v-if="draftWarning" class="papers-workspace__error" role="alert">{{ draftWarning }} <PButton size="sm" variant="ghost" type="button" class="papers-workspace__sync" @click="toggleTool('drafts')">草稿管理</PButton></p>
        <p v-if="exportError" class="papers-workspace__error" role="alert">{{ exportError }}</p>
        <p v-if="saveError" class="papers-workspace__error" role="alert">
          {{ saveError }} 当前输入已保留。
          <PButton size="sm" variant="ghost" type="button" class="papers-workspace__sync" @click="copyDraft">复制当前源码</PButton>
          <PButton size="sm" variant="ghost" type="button" class="papers-workspace__sync" :disabled="saving" @click="saveNow">重试保存</PButton>
        </p>
      </section>
      <div v-if="aiPanelOpen&&!aiCollapsed&&!aiExpanded" class="papers-workspace__ai-divider" role="separator" aria-label="调整 AI 面板高度" aria-orientation="horizontal" tabindex="0" :aria-valuemin="25" :aria-valuemax="70" :aria-valuenow="aiHeight" title="拖动调整高度，双击恢复默认" @dblclick="resizeAI(43)" @pointerdown="beginAIResize" @pointermove="moveAIResize" @pointerup="endAIResize" @pointercancel="endAIResize" @keydown.up.prevent="resizeAI(aiHeight+5)" @keydown.down.prevent="resizeAI(aiHeight-5)" />
      <aside v-if="aiPanelOpen&&aiFile" class="papers-workspace__ai-panel" :class="{collapsed:aiCollapsed}" aria-label="AI 论文助手">
        <div class="papers-workspace__ai-heading">
          <Sparkles :size="16" aria-hidden="true"/><strong>AI 助手</strong>
          <span class="papers-workspace__ai-subtitle" :title="aiFile.path">{{aiFile.path}}</span>
          <PButton v-if="!aiCollapsed" size="sm" variant="ghost" type="button" class="papers-workspace__ai-icon" :aria-label="aiExpanded?'恢复分栏':'展开工作区'" :title="aiExpanded?'恢复分栏':'展开工作区'" :aria-pressed="aiExpanded" @click="aiExpanded=!aiExpanded"><Minimize2 v-if="aiExpanded" :size="15" aria-hidden="true"/><Maximize2 v-else :size="15" aria-hidden="true"/><span class="papers-workspace__sr">{{aiExpanded?'恢复分栏':'展开工作区'}}</span></PButton>
          <PButton size="sm" variant="ghost" type="button" class="papers-workspace__ai-icon" :aria-label="aiCollapsed?'展开 AI':'收起 AI'" :title="aiCollapsed?'展开 AI':'收起 AI'" :aria-expanded="!aiCollapsed" @click="toggleAICollapse"><ChevronDown :size="15" :style="{transform:aiCollapsed?'rotate(180deg)':undefined}" aria-hidden="true"/><span class="papers-workspace__sr">{{aiCollapsed?'展开 AI':'收起 AI'}}</span></PButton>
          <PButton size="sm" variant="ghost" type="button" :disabled="aiApplying" aria-label="关闭 AI" title="关闭并清除当前未保存的 AI 会话" @click="closeTool"><X :size="15" aria-hidden="true"/></PButton>
        </div>
        <div v-show="!aiCollapsed" class="papers-workspace__ai-scroll">
          <PaperAITools :key="projectId+':'+accountId+':'+aiFile.id+':'+(collaborationOpen?aiSharedState?.epoch:'ordinary')" :project-id="projectId" :account-id="accountId" :file="aiFile" :source="collaborationOpen?(aiSharedState?.source||''):draft" :files="files" :collaboration-epoch="collaborationOpen?aiSharedState?.epoch:undefined" :disabled="saving||navigating||switchingFile||uploadBusy||addingFile||snapshotMutating||compiling||hasActiveCompile||(collaborationOpen&&!aiSharedState?.ready)" :capture-selection="captureAISelection" :apply-edit="applyAIEdit" :project-revision="project?.head_revision" :apply-project="applyAIProject" :rollback-activity="rollbackAIActivity" :compile-enabled="compileEnabled" :compile-job="compileJob" :compiler="selectedCompiler" :compile-repair="compileForAI" @repair-active="setAIRepairActive" :diagnostics="diagnostics.map(item=>(item.file?item.file+(item.line?':'+item.line:'')+' ':'')+item.message).join('\n')" />
        </div>
      </aside>
      </div>
      <div v-if="layoutMode === 'split'&&!compactLayout" class="papers-workspace__divider" role="separator" aria-label="调整编辑器和预览宽度" aria-orientation="vertical" tabindex="0" :aria-valuenow="Math.round(previewWidth)" title="拖动调整宽度，双击恢复默认" @dblclick="resetPanelWidths" @pointerdown="beginResize" @pointermove="resizeMove" @pointerup="endResize" @pointercancel="endResize" @keydown.left.prevent="resizePreview(previewWidth+3)" @keydown.right.prevent="resizePreview(previewWidth-3)" />

      <aside v-if="projectToolOpen||outlineOpen&&!collaborationOpen" class="papers-workspace__preview papers-workspace__tools-panel" aria-label="项目工具工作区">
        <section v-if="projectToolOpen" class="papers-workspace__toolpanel" :aria-label="toolMode==='search'?'项目搜索':toolMode==='references'?'参考文献':toolMode==='figures'?'插图管理':toolMode==='snapshots'?'项目快照':toolMode==='drafts'?'草稿恢复':toolMode==='members'?'项目成员':toolMode==='submission'?'投稿检查':toolMode==='git'?'GitHub':'文件历史'">
          <div class="papers-workspace__tool-heading">
            <strong>{{ toolMode==='search'?'全项目搜索与替换':toolMode==='references'?'参考文献库':toolMode==='figures'?'插图管理':toolMode==='snapshots'?'项目快照':toolMode==='drafts'?'草稿恢复':toolMode==='members'?'项目成员':toolMode==='submission'?'投稿前检查':toolMode==='git'?'GitHub 分支发布':'当前文件版本历史' }}</strong>
            <PButton size="sm" variant="ghost" v-if="['search','references','history','snapshots','drafts','members'].includes(toolMode)" type="button" class="papers-workspace__sync"  :disabled="toolBusy||snapshotMutating||memberMutating" @click="refreshTool">刷新</PButton>
            <PButton size="sm" variant="ghost" type="button" class="papers-workspace__sync" :disabled="snapshotMutating||memberMutating" @click="closeTool">关闭</PButton>
          </div>
          <div class="papers-workspace__tool-body">
          <p v-if="toolError" role="alert" class="papers-workspace__error">{{ toolError }}</p>
          <p v-if="toolBusy" role="status">正在读取…</p>
          <template v-if="toolMode==='search'">
            <label>查找（区分大小写）<PInput v-model="searchQuery" maxlength="250" placeholder="输入源码或关键字" /></label>
            <label v-if="ownerAccess">替换为<PInput v-model="replaceQuery" maxlength="1000" placeholder="留空表示删除匹配文字" /></label>
            <p v-if="searchStale">项目或未保存源码已有变化，请刷新搜索后操作。</p>
            <p v-else>{{ searchResult.total }} 处匹配<span v-if="searchResult.total>200">（显示前 200 处）</span></p>
            <PButton v-if="ownerAccess" size="sm" variant="secondary" :disabled="toolBusy||addingFile||switchingFile||navigating||preparingUpload||searchStale||!searchResult.total||searchQuery===replaceQuery" @click="replaceProject">全部替换</PButton>
            <PButton size="sm" variant="ghost" v-for="(hit,index) in searchResult.matches" :key="hit.fileId+':'+hit.line+':'+hit.column+':'+index" type="button" class="papers-workspace__toolrow" :disabled="searchStale" @click="jumpSearch(hit)"><strong>{{ hit.path }}:{{ hit.line }}:{{ hit.column }}</strong><code>{{ hit.preview }}</code></PButton>
          </template>
          <template v-else-if="toolMode==='references'">
            <PaperReferenceImport v-if="ownerAccess" :key="projectId+':'+accountId" :project-id="projectId" :account-id="accountId" :files="files" :disabled="saving||navigating||switchingFile||uploadBusy||snapshotMutating||compiling||hasActiveCompile||(activeFile?.kind==='text'&&draft!==activeFile.content)" :append="appendReferences" />
            <label>查找引用键或标题<PInput v-model="referenceQuery" placeholder="例如 smith2026" maxlength="200" /></label>
            <p v-if="bibError" role="alert">{{ bibError }}</p>
            <p>{{ referenceRows.length }} 条参考文献<span v-if="filteredReferences.length>200">（显示前 200 条）</span>。</p>
            <p v-if="!referenceRows.length">在项目中新建或导入 .bib 文件后即可使用文献检索和引用补全。</p>
            <div v-for="(entry,index) in filteredReferences.slice(0,200)" :key="entry.fileId+':'+entry.key+':'+index" class="papers-workspace__refrow">
              <PButton size="sm" variant="ghost" type="button" class="papers-workspace__toolrow" @click="jumpReference(entry)"><strong>{{ entry.key }}</strong><span>{{ entry.title || entry.path }}</span></PButton>
              <PButton size="sm" variant="ghost" type="button" class="papers-workspace__sync" :disabled="!writeAccess||activeFile?.kind!=='text'||!/\.tex$/i.test(activeFile?.path||'')||switchingFile||addingFile||navigating" @click="insertReference(entry.key)">插入引用</PButton>
            </div>
          </template>
          <template v-else-if="toolMode==='figures'">
          <p v-if="fileError" role="alert" class="papers-workspace__error">{{ fileError }}</p>
          <PaperFigureTools :key="projectId" :project-id="projectId" :files="files" :disabled="uploadBusy||switchingFile||navigating" :can-insert="activeFile?.kind==='text'&&/\.tex$/i.test(activeFile.path)" @upload="uploadFigureFiles" @insert="insertFigure" />
          </template>
          <PaperGitHubTools v-else-if="toolMode==='git'&&ownerAccess" :key="projectId+':'+accountId" mode="export" :project-id="projectId" :account-id="accountId" :revision="project?.head_revision||0" :files="files" :disabled="saving||navigating||switchingFile||uploadBusy||snapshotMutating||compiling||hasActiveCompile||(activeFile?.kind==='text'&&draft!==activeFile.content)" />
          <PaperSubmissionTools v-else-if="toolMode==='submission'&&ownerAccess" :key="projectId+':'+accountId" :project-id="projectId" :account-id="accountId" :revision="project?.head_revision||0" :files="files" :disabled="saving||navigating||switchingFile||uploadBusy||snapshotMutating||compiling||hasActiveCompile||(activeFile?.kind==='text'&&draft!==activeFile.content)" :compile-job="compileJob" :pdf="previewStale?null:submissionPDF" />
          <PaperSnapshotTools v-else-if="toolMode==='snapshots'" :key="projectId" :project-id="projectId" :account-id="accountId" :rows="snapshots" :detail="snapshotDetail" :busy="toolBusy||snapshotMutating" :disabled="uploadBusy||switchingFile||navigating||saving||hasActiveCompile||compiling||(collaborationOpen&&collaborationRevision===null)" :restore-disabled="collaborationOpen" :message="snapshotMessage" @create="createSnapshot" @preview="previewSnapshot" @remove="deleteSnapshot" @restore="restoreSnapshot" />
          <PaperDraftTools v-else-if="toolMode==='drafts'" :key="projectId+':'+accountId" :available="draftAvailable" :enabled="draftEnabled" :rows="draftRows" :files="files" :disabled="uploadBusy||switchingFile||navigating||saving" :can-recover="canRecoverDraft" :message="draftMessage" @toggle="toggleDraftProtection" @recover="recoverDraft" @remove="discardDraft" />
          <template v-else-if="toolMode==='members'">
            <PaperShareLinks v-if="ownerAccess" :key="'share:'+projectId+':'+accountId" :project-id="projectId" :account-id="accountId" :disabled="navigating||memberMutating||snapshotMutating" />
            <PaperMemberTools v-if="ownerAccess" :key="projectId+':'+accountId" :rows="members" :account-id="accountId" :busy="toolBusy||memberMutating" :disabled="navigating||uploadBusy||snapshotMutating" :message="memberMessage" @set="changeMember" @remove="deleteMember" />
            <div v-else><p>项目权限：{{ roleLabel }}。仅所有者可以管理共享成员。</p><p v-if="accountId">我的账号 UUID：<code>{{ accountId }}</code></p></div>
          </template>
          <template v-else-if="toolMode==='history'">
            <p v-if="activeFile?.kind!=='text'">请选择文本文件。</p>
            <PButton size="sm" variant="ghost" v-for="version in fileVersions" :key="version.revision" type="button" class="papers-workspace__toolrow" :disabled="toolBusy" @click="previewVersion(version)"><strong>版本 {{ version.revision }}{{ activeFile?.revision===version.revision?' · 当前':'' }}</strong><span>{{ formatVersionDate(version.created_at) }} · {{ version.path }}</span></PButton>
            <PButton size="sm" variant="ghost" v-if="moreVersions" type="button" class="papers-workspace__sync" :disabled="toolBusy" @click="loadVersions(true)">加载更早版本</PButton>
            <div v-if="selectedVersion" class="papers-workspace__version-preview">
              <strong>版本 {{ selectedVersion.revision }} 与当前编辑内容对比</strong>
              <p v-if="versionDifference">差异范围：旧版第 {{ versionDifference.from }}–{{ Math.max(versionDifference.from,versionDifference.oldTo) }} 行；当前第 {{ versionDifference.from }}–{{ Math.max(versionDifference.from,versionDifference.newTo) }} 行。</p>
              <p v-else>源码一致。</p>
              <div class="papers-workspace__compare"><label>历史源码<PTextarea readonly :model-value="selectedVersion.content" /></label><label>当前源码<PTextarea readonly :model-value="draft" /></label></div>
              <PButton size="sm" variant="secondary" :disabled="toolBusy||addingFile||switchingFile||preparingUpload||!versionDifference" @click="restoreVersion">恢复源码为此版本</PButton>
            </div>
          </template>
          </div>
        </section>
        <section v-if="outlineOpen&&!collaborationOpen" class="papers-workspace__outline papers-workspace__toolpanel" aria-label="论文结构大纲">
          <div class="papers-workspace__tool-heading"><strong>项目大纲</strong><PButton size="sm" variant="ghost" type="button" class="papers-workspace__sync" :disabled="outlineLoading" @click="loadOutline">刷新</PButton><PButton size="sm" variant="ghost" type="button" @click="toggleOutline">关闭</PButton></div>
          <div class="papers-workspace__tool-body">
          <p v-if="outlineLoading">正在读取各 TeX 文件…</p>
          <p v-else-if="!outlineRows.length">未找到章节标题。</p>
          <PButton size="sm" variant="ghost" v-for="item in outlineRows" :key="item.fileId+':'+item.line+':'+item.title" type="button" :style="{paddingLeft:Math.max(0,item.level-1)*12+'px'}" :title="item.path+':'+item.line" @click="jumpOutline(item)">{{ item.title }} <small>{{ item.path }}:{{ item.line }}</small></PButton>
          </div>
        </section>
      </aside>
      <aside v-show="!sideToolOpen&&layoutMode!=='editor'" class="papers-workspace__preview papers-workspace__pdf-panel" aria-label="编译预览">
        <div class="papers-workspace__preview-heading">
          <div class="papers-workspace__preview-left">
            <strong>PDF 预览</strong>
            <PButton size="sm" variant="ghost" type="button" class="papers-workspace__sync papers-workspace__preview-icon" aria-label="跳到源码" title="跳到预览对应源码（也可双击 PDF）" :disabled="!syncReady" @click="jumpToCode"><ArrowLeft :size="15" aria-hidden="true" /><span class="papers-workspace__sr">源码</span></PButton>
          </div>
          <div class="papers-workspace__compile-status" role="status" aria-live="polite">
            <template v-if="compileEnabled && compileJob">
              <span class="papers-workspace__compile-label" :class="'status-'+compileJob.status" :title="compileStateLabel+' · '+compilerLabel(compileJob.compiler)+' · 版本 '+compileJob.source_revision"><strong>{{ compileStateLabel }}</strong> · {{ compilerLabel(compileJob.compiler) }} · 版本 {{ compileJob.source_revision }}</span>
              <span v-if="previewStale" class="papers-workspace__stale" title="当前 PDF 是上一次编译成功的版本">预览为上次成功版本</span>
              <PButton v-if="canCancelCompile" type="button" size="sm" variant="ghost" class="papers-workspace__cancel-compile" :aria-label="canceling?'取消中…':'取消任务'" :title="canceling?'取消中…':'取消任务'" :disabled="canceling" @click="cancelCompile"><X :size="13" aria-hidden="true" /><span class="papers-workspace__sr">{{ canceling ? '取消中…' : '取消任务' }}</span></PButton>
              <span v-else-if="compileJob.cancel_requested && hasActiveCompile">取消中…</span>
              <PButton size="sm" variant="ghost" v-if="compileJob.failure_code" type="button" class="papers-workspace__sync" :aria-expanded="showDiagnostics" @click="showDiagnostics=!showDiagnostics">错误详情{{ diagnostics.length ? ' ('+diagnostics.length+')' : '' }}</PButton>
            </template>
            <span v-else-if="compileEnabled">准备编译</span>
            <span v-else-if="!ownerAccess&&previewJob">共享 PDF · 版本 {{ previewJob.source_revision }}<template v-if="previewJob.source_revision!==project?.head_revision">（上次成功版本）</template></span>
          </div>
          <div class="papers-workspace__preview-right">
            <PButton v-if="!ownerAccess" type="button" size="sm" variant="secondary" :disabled="sharedPreviewBusy" @click="loadSharedPreview">{{ sharedPreviewBusy?'刷新中…':'刷新预览' }}</PButton>
            <div class="papers-workspace__compiler" title="选择此任务的 TeX 编译器"><span>编译器</span><PSelect :model-value="selectedCompiler" placeholder="TeX 编译器" size="sm" :options="compilerOptions.map(value=>({value,label:compilerLabel(value)}))"  :disabled="!compileEnabled||compiling||hasActiveCompile||saving||uploadBusy||navigating||aiRepairActive||aiApplying" @update:model-value="selectedCompiler=$event as PaperCompiler;compilerChanged()" /></div>
            <PCheckbox v-model="autoCompile" class="papers-workspace__auto" :disabled="collaborationOpen||!compileEnabled||recommendedUnavailable||aiRepairActive||aiApplying">自动编译</PCheckbox>
            <PButton type="button" size="sm" :disabled="(collaborationOpen&&collaborationRevision===null) || !compileEnabled || compiling || saving || switchingFile || navigating || uploadBusy || snapshotMutating || !project || hasActiveCompile || aiRepairActive || aiApplying" @click="compileNow">{{ compiling ? '提交中...' : hasActiveCompile ? '编译中' : '编译' }}</PButton>
          </div>
        </div>
        <p v-if="collaborationOpen&&compileEnabled" class="papers-workspace__stale" role="status">{{collaborationRevision!==null?'编译已确认的项目版本 '+collaborationRevision+'，不会包含尚未提交的修改。':'等待当前协作修改确认后可编译。'}} 协作期间暂不开放自动编译及源码定位。</p>
        <p v-if="syncMessage" class="papers-workspace__sync-message" role="status">{{ syncMessage }}</p>
        <p v-if="recommendedUnavailable&&!collaborationOpen" class="papers-workspace__stale" role="status">源码建议使用 {{ compilerLabel(recommendedCompiler) }}，当前编译环境尚未开放此编译器；可继续编辑源码。</p>
        <p v-if="compileError" class="papers-workspace__error" role="alert">{{ compileError }}</p>
        <section v-if="showDiagnostics && compileJob?.failure_code" class="papers-workspace__diagnostics" aria-label="编译错误详情">
          <div class="papers-workspace__diagnostics-header">
            <strong>{{ failureMessage(compileJob.failure_code) }}</strong>
            <PButton size="sm" variant="ghost" type="button" class="papers-workspace__sync" @click="showDiagnostics=false">收起</PButton>
          </div>
          <p v-if="diagnostics.length && diagnosticStale" class="papers-workspace__stale">源码已发生变化。以下行号对应编译版本 {{ compileJob.source_revision }}，重新编译后可准确定位。</p>
          <div v-for="(item,index) in diagnostics" :key="index" class="papers-workspace__diagnostic">
            <PButton size="sm" variant="ghost" v-if="item.file && item.line" type="button" class="papers-workspace__diagnostic-location" :disabled="diagnosticStale" @click="jumpDiagnostic(item)">{{ item.file }}:{{ item.line }}</PButton>
            <span v-else>{{ item.tool==='bibtex' ? 'BibTeX' : 'LaTeX' }}</span>
            <code>{{ item.message }}</code>
          </div>
          <p v-if="!diagnostics.length">本次任务没有可用的源码错误详情。旧版编译结果需要重新编译，系统环境错误不会提供宿主机日志。</p>
          <small>错误代码：{{ compileJob.failure_code }} · 源码版本 {{ compileJob.source_revision }}</small>
        </section>
        <p v-if="!ownerAccess&&sharedPreviewError" class="papers-workspace__error" role="alert">{{ sharedPreviewError }}</p>
        <div v-if="!ownerAccess&&!previewJob" class="papers-workspace__preview-empty"><p>{{ sharedPreviewBusy?'正在读取共享 PDF…':'暂无可查看的已编译 PDF。请等待拥有者编译后刷新预览。' }}</p></div>
        <div v-else-if="ownerAccess&&!compileEnabled" class="papers-workspace__preview-empty">
          <strong>编译尚未开放</strong>
          <p>源码编辑与保存可用。可信编译服务尚未完成生产安全验收，编译按钮保持禁用。</p>
        </div>
        <div v-else-if="ownerAccess&&!compileJob" class="papers-workspace__preview-empty">
          <p>点击编译生成 PDF。</p>
        </div>
        <p v-else-if="ownerAccess&&compileJob?.status === 'succeeded' && (!pdfEnabled || !compileJob.pdf_available)" class="papers-workspace__message">编译已完成，暂无可验证的 PDF 产物。</p>
        <PaperPDFPreview
          v-if="pdfEnabled && previewJob"
          ref="pdfRef"
          :key="projectId+':'+accountId"
          :project-id="projectId"
          :job-id="previewJob.id"
          :revision="previewJob.source_revision"
          @pdf-position="jumpFromPDF"
          @displayed-job="displayedPDFJob = $event"
          @page-count="submissionPDF = $event"
        />
      </aside>
    </div>
  <PaperQuickOpen v-if="project&&!loading&&!error" v-model:show="quickOpen" :files="files" :recent="recentFileIds" :active-id="activeFile?.id" :disabled="!canSwitchWorkspaceFile" @choose="openWorkspaceFile" />
  <PConfirm :show="!!confirmationMessage" title="请确认操作" :message="confirmationMessage" danger @confirm="resolveConfirmation(true)" @cancel="resolveConfirmation(false)" />
  </main>
</template>

<script setup lang="ts">
import PInput from '@/components/ui/PInput.vue'
import PTextarea from '@/components/ui/PTextarea.vue'
import PSelect from '@/components/ui/PSelect.vue'
import PCheckbox from '@/components/ui/PCheckbox.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ApiErrorResponseError } from '@/api/client'
import { ChevronDown, ChevronRight, Folder, FolderOpen, FileCode2, FileText, Image as ImageIcon, Plus, Upload, PanelLeftClose, Sparkles, Search, BookOpen, History, Layers, GitBranch, ClipboardCheck, FileClock, Users, RefreshCw, X, Maximize2, Minimize2, ArrowLeft, ArrowRight, PanelLeft, Columns2, FileCode, FileOutput, Download, Save, ListTree } from 'lucide-vue-next'
import {useAuthStore} from '@/stores/auth'
import PaperSnapshotTools from '@/components/papers/PaperSnapshotTools.vue'
import PaperDraftTools from '@/components/papers/PaperDraftTools.vue'
import PaperMemberTools from '@/components/papers/PaperMemberTools.vue'
import PaperShareLinks from '@/components/papers/PaperShareLinks.vue'
import PaperAITools from '@/components/papers/PaperAITools.vue'
import type {PaperAIEdit,PaperAISharedState} from '@/components/papers/aiSuggestion'
import {validRepairApplyFence,type RepairApplyFence} from '@/components/papers/aiRepair'
import type {PaperAIActivity} from '@/api/papersAI'
import PaperCollaborationPanel from '@/components/papers/PaperCollaborationPanel.vue'
import {collaborationCapabilityError,collaborationUnavailableReason} from '@/components/papers/collaborationCapability'
import {draftKey,listLocalDrafts,localDraftEnabled,setLocalDraftEnabled,writeLocalDraft,readLocalDraft,removeLocalDraft,sameLocalDraft,matchesLocalDraftBase,type PaperLocalDraft} from '@/components/papers/localDrafts'
import PConfirm from '@/components/ui/PConfirm.vue'
import PaperQuickOpen from '@/components/papers/PaperQuickOpen.vue'
import {rememberPaperTab} from '@/components/papers/workbenchNavigation'
import {usePaperConfirmation} from '@/components/papers/usePaperConfirmation'
import PButton from '@/components/ui/PButton.vue'
import LatexEditor from '@/components/papers/LatexEditor.vue'
import PaperAssetPreview from '@/components/papers/PaperAssetPreview.vue'
import PaperFigureTools from '@/components/papers/PaperFigureTools.vue'
import {prepareFigureUploads,type FigureInsertion} from '@/components/papers/figureTools'
import {paperFileTree,preparePaperUploads} from '@/components/papers/fileTools'
import {searchProject,planProjectReplacement,bibtexReferences,changedLineRange,type ProjectMatch,type PaperReference} from '@/components/papers/projectTools'
import {latexHeadings,recommendedTexCompiler,type LatexHeading} from '@/components/papers/latexLanguage'
import PaperPDFPreview from '@/components/papers/PaperPDFPreview.vue'
import PaperSubmissionTools from '@/components/papers/PaperSubmissionTools.vue'
import PaperReferenceImport from '@/components/papers/PaperReferenceImport.vue'
import PaperGitHubTools from '@/components/papers/PaperGitHubTools.vue'
import {planBibtexAppend,existingBibtexKeys} from '@/components/papers/referenceImport'
import {readProjectText,projectFileFence} from '@/components/papers/projectRead'
import { decodeSourceMap, sourceToPDF, pdfToSource, type PaperSourceMap } from '@/components/papers/sourceMap'
import {
  createPaperFile, managePaperFiles, getPaperFile, getPaperProject, listPaperFiles, savePaperFile, getPaperProjectZIP, downloadPaperZIP,
  getPaperSharedPreview, getPaperCollaborationCapability, getPaperCompileCapability, getPaperCompileJob, listPaperCompileJobs, submitPaperCompile, cancelPaperCompile, getPaperCompileSourceMap,
  listPaperFileVersions, getPaperFileVersion,
  listPaperProjectSnapshots,getPaperProjectSnapshot,createPaperProjectSnapshot,restorePaperProjectSnapshot,deletePaperProjectSnapshot,
  listPaperMembers,setPaperMember,removePaperMember,type PaperProjectMember,type PaperMemberRole,
  type PaperProjectSnapshot,type PaperSnapshotDetail,type PaperProjectRole,
  type PaperCompiler, type PaperCompileCapability, type PaperFileVersion, type PaperVersionSummary, type PaperFile, type PaperProject, type PaperCompileJob, type PaperCompileDiagnostic, type PaperUpload, type PaperTextReplacement,
} from '@/api/papers'

defineOptions({name:'PaperWorkspaceView'})
const route = useRoute()
const router=useRouter()
const auth=useAuthStore()
const {confirmationMessage,ask,resolveConfirmation}=usePaperConfirmation()
const accountId=computed(()=>auth.isAuthenticated?auth.user?.uuid||'':'')
const projectId = computed(() => String(route.params.projectId || ''))
const loading = ref(true)
const error = ref('')
const fileError = ref('')
const switchingFile=ref(false)
const navigating=ref(false)
const saveError = ref('')
const saving = ref(false)
const exporting = ref(false)
const exportError = ref('')
const addingFile = ref(false)
const snapshotMutating=ref(false)
const aiApplying=ref(false)
const aiRepairActive=ref(false)
function setAIRepairActive(active:boolean){aiRepairActive.value=active;if(active)clearAuto();else scheduleAuto()}
const project = ref<PaperProject | null>(null)
const ownerAccess=computed(()=>!!project.value&&(project.value.access_role===undefined||project.value.access_role==='owner'))
const writeAccess=computed(()=>ownerAccess.value||project.value?.access_role==='editor')
const roleLabel=computed(()=>ownerAccess.value?'所有者':writeAccess.value?'编辑者':'阅读者')
const confirmPaper=(message:string)=>ask(message,()=>[
 !disposed&&!navigating.value,accountId.value,projectId.value,project.value?.id,project.value?.head_revision,
 ownerAccess.value,writeAccess.value,activeFile.value?.id,activeFile.value?.revision,draft.value,
 collaborationOpen.value,toolMode.value,managedFile.value?.id,managedPath.value,selectedVersion.value,
 searchBase.value,searchQuery.value,replaceQuery.value,
])
const members=shallowRef<PaperProjectMember[]>([])
const memberMessage=ref('')
const memberMutating=ref(false)
let memberSerial=0

const files = ref<PaperFile[]>([])
const closedFolders=ref(new Set<string>())
const fileFilter=ref('')
const fileAction=ref<''|'create'|'upload'>('')
const treeRows=computed(()=>paperFileTree(files.value,closedFolders.value))
const visibleTreeRows=computed(()=>{
 const query=fileFilter.value.toLocaleLowerCase()
 if(!query)return treeRows.value
 return paperFileTree(files.value.filter(file=>file.path.toLocaleLowerCase().includes(query)),new Set<string>())
})
function toggleFolder(path:string){const next=new Set(closedFolders.value);if(next.has(path))next.delete(path);else next.add(path);closedFolders.value=next}
const managedFile=ref<PaperFile|null>(null),managedPath=ref('')
const uploadDir=ref(''),uploadInput=ref<HTMLInputElement|null>(null)
const preparingUpload=ref(false),draggingFiles=ref(false)
const uploadBusy=computed(()=>addingFile.value||preparingUpload.value)
let uploadSerial=0
function openFileMenu(file:PaperFile){if(collaborationOpen.value||!ownerAccess.value)return;fileAction.value='';managedFile.value=managedFile.value?.id===file.id?null:file;managedPath.value=file.path}
function revealFile(path:string){const next=new Set(closedFolders.value);const parts=path.split('/');for(let i=1;i<parts.length;i++)next.delete(parts.slice(0,i).join('/'));closedFolders.value=next}
function managementError(cause:unknown){
 if(cause instanceof ApiErrorResponseError){
  const labels:Record<string,string>={
   'papers.invalid_main_file':'主文件必须是根目录 .tex；若存在 main.tex，请先重命名它，再切换主文件。',
   'papers.file_exists':'与现有文件或文件夹路径冲突，请换一个名称。',
   'papers.revision_conflict':'项目已被修改，请刷新后重试。',
   'papers.main_file_required':'不能删除主文件，请先设置另一个主文件。',
   'papers.compile_source_limit':'超出项目容量或编译兼容性限制。',
   'papers.file_limit':'超过项目文件数量限制。'
  }
  return labels[cause.code]||'操作失败，请检查文件路径、格式及项目容量。'
 }
 return cause instanceof Error?cause.message:'文件操作失败，请重试。'
}
async function mutateFiles(change:{action:'upload'|'rename'|'delete'|'set_main';file_id?:string;path?:string;uploads?:PaperUpload[]}){
 if(!ownerAccess.value||addingFile.value||switchingFile.value||navigating.value||!project.value)return
 const pid=projectId.value
 addingFile.value=true;fileError.value=''
 try{
  await nextTick()
  if(!await persist()||disposed||pid!==projectId.value||navigating.value||!project.value)return
  const result=await managePaperFiles(pid,{...change,base_revision:project.value.head_revision})
  if(disposed||pid!==projectId.value||navigating.value)return
  project.value=result.project;files.value=result.files
  const prior=activeFile.value
  if(prior){
   const updated=result.files.find(f=>f.id===prior.id)
   if(updated){activeFile.value={...updated,content:prior.content};revealFile(updated.path)}
   else{activeFile.value=null;draft.value='';const main=result.files.find(f=>f.id===result.project.main_file_id);if(main)await selectFile(main)}
  }
  if(change.path)revealFile(change.path)
  if(change.uploads)for(const u of change.uploads)revealFile(u.path)
  managedFile.value=null;autoDirty=true
  if(outlineOpen.value)void loadOutline()
 }catch(cause){if(!disposed&&pid===projectId.value)fileError.value=managementError(cause)}
 finally{if(pid===projectId.value){addingFile.value=false;scheduleAuto()}}
}
async function changeFile(action:'rename'|'delete'|'set_main'){
 const f=managedFile.value;if(!ownerAccess.value||!f||uploadBusy.value)return
 const path=managedPath.value
 if(action==='delete'&&!await confirmPaper('删除 '+f.path+'？请确认源码中没有仍依赖它的引用。'))return
 if(action==='rename'&&!await confirmPaper('修改文件路径？引用该文件的 LaTeX 命令需要手动更新。'))return
 if(disposed||navigating.value||collaborationOpen.value||!ownerAccess.value||managedFile.value?.id!==f.id||managedPath.value!==path||uploadBusy.value)return
 await mutateFiles({action,file_id:f.id,path:action==='rename'?path:undefined})
}
async function uploadPicked(picked:File[],directory:string,figuresOnly=false){
 if(!ownerAccess.value||!picked.length||uploadBusy.value||switchingFile.value||navigating.value||!project.value||disposed)return
 const pid=projectId.value,serial=++uploadSerial
 const valid=()=>!disposed&&pid===projectId.value&&serial===uploadSerial&&!navigating.value
 preparingUpload.value=true;fileError.value=''
 try{
  const uploads=await (figuresOnly?prepareFigureUploads(picked,directory):preparePaperUploads(picked,directory))
  if(valid())await mutateFiles({action:'upload',uploads})
 }catch(cause){if(valid())fileError.value=managementError(cause)}
 finally{if(pid===projectId.value&&serial===uploadSerial){preparingUpload.value=false;scheduleAuto()}}
}
function uploadFiles(event:Event){
 const input=event.target as HTMLInputElement
 const picked=Array.from(input.files||[]);input.value=''
 void uploadPicked(picked,uploadDir.value)
}
function uploadFigureFiles(picked:File[]){
 // File errors must remain visible even in compact mode when the sidebar is closed.
 void uploadPicked(picked,uploadDir.value.trim()||'figures',true)
}
function onFigureDragOver(event:DragEvent){
 if(!event.dataTransfer||!Array.from(event.dataTransfer.types||[]).includes('Files'))return
 event.preventDefault()
 const busy=!ownerAccess.value||uploadBusy.value||switchingFile.value||navigating.value
 event.dataTransfer.dropEffect=busy?'none':'copy'
 draggingFiles.value=!busy
}
function onFigureDragLeave(event:DragEvent){
 const target=event.currentTarget,related=event.relatedTarget
 if(target instanceof Element&&related instanceof Node&&target.contains(related))return
 draggingFiles.value=false
}
function onFigureDrop(event:DragEvent){
 const transfer=event.dataTransfer
 draggingFiles.value=false
 if(!transfer||(!transfer.files.length&&!Array.from(transfer.types||[]).includes('Files')))return
 event.preventDefault()
 uploadFigureFiles(Array.from(transfer.files))
}
function insertFigure(figure:FigureInsertion){
 if(!ownerAccess.value||uploadBusy.value||switchingFile.value||navigating.value||!activeFile.value||activeFile.value.kind!=='text'||!/\.tex$/i.test(activeFile.value.path))return
 if(!files.value.some(f=>f.kind==='binary'&&f.id===figure.id&&f.revision===figure.revision&&f.path===figure.path))return
 if(editorRef.value?.insertBlock(figure.code))closeTool()
}

const collaborationOpen=ref(false)
const collaborationRevision=ref<number|null>(null)
const aiSharedState=shallowRef<PaperAISharedState|null>(null)
function onCollaborationAIState(state:PaperAISharedState|null){
 if(collaborationOpen.value&&collaborationAccount.value===accountId.value)aiSharedState.value=state
}
function onCollaborationConfirmed(revision:number|null){
 if(collaborationOpen.value&&collaborationAccount.value===accountId.value)collaborationRevision.value=revision
}
function currentCollaborationRevision():number|null{
 if(!collaborationOpen.value||!ownerAccess.value||collaborationAccount.value!==accountId.value)return null
 return collaborationRef.value?.confirmedRevision()??null
}
const collaborationRef=ref<InstanceType<typeof PaperCollaborationPanel>|null>(null)
const collaborationAccount=ref('')
const activeFile = ref<PaperFile | null>(null)
const draft = ref('')
const tabIds=ref<string[]>([]),recentFileIds=ref<string[]>([])
const quickOpen=ref(false)
const openTabs=computed(()=>tabIds.value.map(id=>files.value.find(file=>file.id===id)).filter((file):file is PaperFile=>!!file))
const canChooseTreeFile=computed(()=>!!project.value&&!!activeFile.value&&!loading.value&&!error.value&&!collaborationOpen.value&&!navigating.value&&!uploadBusy.value&&!snapshotMutating.value&&!memberMutating.value&&!aiApplying.value&&!aiRepairActive.value&&!confirmationMessage.value)
const canSwitchWorkspaceFile=computed(()=>canChooseTreeFile.value&&!switchingFile.value)
watch(()=>activeFile.value?.id,id=>{
 if(!id)return
 tabIds.value=rememberPaperTab(tabIds.value,id)
 recentFileIds.value=[id,...recentFileIds.value.filter(value=>value!==id)].slice(0,32)
},{flush:'sync'})
watch(()=>files.value.map(file=>file.id).join('|'),()=>{
 const ids=new Set(files.value.map(file=>file.id))
 tabIds.value=tabIds.value.filter(id=>ids.has(id))
 recentFileIds.value=recentFileIds.value.filter(id=>ids.has(id))
 if(activeFile.value&&ids.has(activeFile.value.id))tabIds.value=rememberPaperTab(tabIds.value,activeFile.value.id)
})
watch([accountId,projectId],()=>{tabIds.value=[];recentFileIds.value=[];quickOpen.value=false},{flush:'sync'})
watch(canSwitchWorkspaceFile,allowed=>{if(!allowed)quickOpen.value=false})
function openQuick(){if(canSwitchWorkspaceFile.value)quickOpen.value=true}
async function openWorkspaceFile(file:PaperFile){
 if(!canSwitchWorkspaceFile.value||!files.value.some(f=>f.id===file.id&&f.path===file.path))return
 const pid=projectId.value,account=accountId.value
 await selectFile(file)
 if(pid===projectId.value&&account===accountId.value&&activeFile.value?.id===file.id){
  aiExpanded.value=false
  if(compactLayout.value||layoutMode.value==='pdf')setWorkspaceLayout('editor')
  await nextTick()
  editorRef.value?.focusEditor?.()
 }
}
async function closeWorkspaceTab(file:PaperFile){
 if(!canSwitchWorkspaceFile.value||openTabs.value.length<2)return
 const pid=projectId.value,account=accountId.value
 if(activeFile.value?.id===file.id){
  const i=openTabs.value.findIndex(row=>row.id===file.id)
  const other=openTabs.value[i-1]||openTabs.value[i+1]
  if(!other)return
  await openWorkspaceFile(other)
  if(pid!==projectId.value||account!==accountId.value||activeFile.value?.id!==other.id)return
 }
 tabIds.value=tabIds.value.filter(id=>id!==file.id)
}
function updateDraft(value:string){if(writeAccess.value&&!collaborationOpen.value)draft.value=value}
const refreshMessage=ref('')

type ToolMode='search'|'references'|'history'|'figures'|'snapshots'|'drafts'|'members'|'ai'|'submission'|'git'
const toolMode=ref<ToolMode|''>(''),toolBusy=ref(false),toolError=ref('')
const aiFile=computed<PaperFile|null>(()=>{
 const file=activeFile.value
 if(!file||file.kind!=='text')return null
 if(!collaborationOpen.value)return file
 const state=aiSharedState.value
 return state?{...file,revision:state.revision,content:state.source}:null
})
const aiPanelOpen=computed(()=>toolMode.value==='ai'&&ownerAccess.value&&!!aiFile.value)
const projectToolOpen=computed(()=>!!toolMode.value&&toolMode.value!=='ai'&&(!collaborationOpen.value||toolMode.value==='snapshots'))
const sideToolOpen=computed(()=>projectToolOpen.value||outlineOpen.value&&!collaborationOpen.value)
const auxiliaryOpen=computed(()=>aiPanelOpen.value||sideToolOpen.value)
const aiExpanded=ref(false),aiCollapsed=ref(false)
watch(aiPanelOpen,open=>{if(!open){aiExpanded.value=false;aiCollapsed.value=false}})
function toggleAICollapse(){
 if(aiApplying.value)return
 aiCollapsed.value=!aiCollapsed.value
 if(aiCollapsed.value)aiExpanded.value=false
}
const searchQuery=ref(''),replaceQuery=ref(''),referenceQuery=ref('')
const searchSources=shallowRef<PaperFile[]>([]),searchBase=ref(0)
const searchStale=computed(()=>!searchBase.value||searchBase.value!==project.value?.head_revision||(activeFile.value?.kind==='text'&&draft.value!==activeFile.value.content))
const searchResult=computed(()=>searchProject(searchSources.value,searchQuery.value))
const bibSources=shallowRef<PaperFile[]>([]),bibError=ref('')
const referenceRows=computed(()=>bibtexReferences(bibSources.value.map(f=>f.id===activeFile.value?.id?{...f,content:draft.value}:f)))
const citationKeys=computed(()=>[...new Set(referenceRows.value.map(r=>r.key))])
const filteredReferences=computed(()=>{const q=referenceQuery.value.trim().toLowerCase();return referenceRows.value.filter(r=>(r.key+' '+r.title).toLowerCase().includes(q))})
const fileVersions=shallowRef<PaperVersionSummary[]>([]),selectedVersion=shallowRef<PaperFileVersion|null>(null),moreVersions=ref(false)
const versionDifference=computed(()=>selectedVersion.value?changedLineRange(selectedVersion.value.content,draft.value):null)
const snapshots=shallowRef<PaperProjectSnapshot[]>([])
const snapshotDetail=shallowRef<PaperSnapshotDetail|null>(null)
const snapshotMessage=ref('')
const draftScopeOwner=ref('')
const draftRows=shallowRef<PaperLocalDraft[]>([])
const draftEnabled=ref(false),draftMessage=ref(''),draftWarning=ref('')
const draftAvailable=computed(()=>!!draftScopeOwner.value&&draftScopeOwner.value===accountId.value&&project.value?.id===projectId.value)
const canRecoverDraft=computed(()=>writeAccess.value&&draftAvailable.value&&!saving.value&&(!activeFile.value||activeFile.value.kind!=='text'||draft.value===activeFile.value.content))
const writerId=globalThis.crypto?.randomUUID?.()||('writer-'+Date.now()+'-'+Math.random().toString(36).slice(2))
const ownBackups=new Map<string,PaperLocalDraft>()
const recoveredBackups=new Map<string,PaperLocalDraft>()
function resetLocalDraftScope(){
 draftScopeOwner.value='';draftEnabled.value=false;draftRows.value=[];draftMessage.value='';draftWarning.value=''
 ownBackups.clear();recoveredBackups.clear()
}
watch(accountId,resetLocalDraftScope)
function refreshLocalDrafts(){
 if(!draftAvailable.value){draftRows.value=[];return}
 try{draftEnabled.value=localDraftEnabled(localStorage,draftScopeOwner.value);draftRows.value=listLocalDrafts(localStorage,draftScopeOwner.value,projectId.value)}
 catch{draftWarning.value='无法读取本机草稿存储，请复制未保存的源码。'}
}
function initializeLocalDrafts(owner:string){
 resetLocalDraftScope()
 if(!owner||owner!==accountId.value)return
 draftScopeOwner.value=owner
 refreshLocalDrafts()
}
function recordLocalDraft(row:PaperLocalDraft){
 draftRows.value=[row,...draftRows.value.filter(item=>draftKey(item)!==draftKey(row))]
}
function deleteUnchangedLocalDraft(row:PaperLocalDraft){
 if(removeLocalDraft(localStorage,row))draftRows.value=draftRows.value.filter(item=>draftKey(item)!==draftKey(row))
}
function syncLocalDraft(){
 if(!draftAvailable.value)return
 const file=activeFile.value
 if(!file||file.kind!=='text')return
 try{
  const previous=ownBackups.get(file.id)
  if(draft.value===file.content){
   if(previous){deleteUnchangedLocalDraft(previous);ownBackups.delete(file.id)}
   return
  }
  if(!draftEnabled.value)return
  const row:PaperLocalDraft={version:1,owner:draftScopeOwner.value,projectId:projectId.value,fileId:file.id,writerId,path:file.path,baseRevision:file.revision,baseSHA:file.sha256||'',content:draft.value,updatedAt:Date.now()}
  writeLocalDraft(localStorage,row)
  ownBackups.set(file.id,row);recordLocalDraft(row);draftWarning.value=''
 }catch{draftWarning.value='本机草稿备份失败：存储空间不足或浏览器限制。请复制当前源码后继续。'}
}
function acknowledgeLocalDraft(saved:PaperFile){
 if(!draftAvailable.value)return
 try{
  const own=ownBackups.get(saved.id)
  if(own&&own.content===saved.content){deleteUnchangedLocalDraft(own);ownBackups.delete(saved.id)}
  const recovered=recoveredBackups.get(saved.id)
  if(recovered&&recovered.content===saved.content){deleteUnchangedLocalDraft(recovered);recoveredBackups.delete(saved.id)}
 }catch{draftWarning.value='无法清理已提交的本机草稿，请手动检查。'}
 syncLocalDraft()
}
function toggleDraftProtection(enabled:boolean){
 if(!draftAvailable.value)return
 try{
  setLocalDraftEnabled(localStorage,draftScopeOwner.value,enabled);draftEnabled.value=enabled
  draftMessage.value=enabled?'本机保护已开启，仅备份未保存源码。':'本机保护已关闭，已有草稿仍可查看和删除。'
  if(enabled)syncLocalDraft()
 }catch{draftWarning.value='无法更新本机草稿设置。'}
}
async function discardDraft(row:PaperLocalDraft){
 if(!draftAvailable.value||row.owner!==draftScopeOwner.value||row.projectId!==projectId.value)return
 if(!await confirmPaper('删除这份本机草稿？此操作不会修改服务器文件。'))return
 try{
  if(!removeLocalDraft(localStorage,row)){refreshLocalDrafts();draftMessage.value='草稿已变化，请重新选择。';return}
  if(draftKey(ownBackups.get(row.fileId)||row)===draftKey(row))ownBackups.delete(row.fileId)
  if(draftKey(recoveredBackups.get(row.fileId)||row)===draftKey(row))recoveredBackups.delete(row.fileId)
  refreshLocalDrafts();draftMessage.value='本机草稿已删除。'
 }catch{draftWarning.value='无法删除本机草稿，请检查浏览器设置。'}
}
async function recoverDraft(row:PaperLocalDraft){
 if(!canRecoverDraft.value||uploadBusy.value||switchingFile.value||navigating.value||row.owner!==draftScopeOwner.value||row.projectId!==projectId.value)return
 const target=files.value.find(f=>matchesLocalDraftBase(row,f))
 if(!target){draftMessage.value='服务器版本已变化，请复制草稿并手动合并。';return}
 if(!await confirmPaper('将本机草稿恢复至编辑器？基础版本一致时才可恢复，恢复后将按正常流程保存。'))return
 try{
  await selectFile(target)
  const file=activeFile.value
  if(!draftAvailable.value||disposed||row.owner!==draftScopeOwner.value||row.projectId!==projectId.value||!file||!matchesLocalDraftBase(row,file)||draft.value!==file.content||!sameLocalDraft(readLocalDraft(localStorage,row),row)){
   refreshLocalDrafts();draftMessage.value='文件或草稿已变化，请重新选择并手动合并。';return
  }
  recoveredBackups.set(file.id,row)
  if(row.content===file.content){acknowledgeLocalDraft(file);refreshLocalDrafts();draftMessage.value='草稿内容已存在于服务器。';return}
  draft.value=row.content
  draftMessage.value='草稿已恢复到编辑器，等待保存确认。'
  closeTool()
 }catch{draftWarning.value='无法恢复草稿，请复制草稿并手动合并。'}
}
function onDraftStorage(event:StorageEvent){
 if(draftAvailable.value&&(event.key===null||event.key.startsWith('atoman.papers.local-draft')))refreshLocalDrafts()
}

let toolSerial=0,bibSerial=0
function formatVersionDate(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleString()}
function closeTool(){if(aiApplying.value)return;toolSerial++;toolMode.value='';toolBusy.value=false;toolError.value='';selectedVersion.value=null;snapshotDetail.value=null;if(compactLayout.value&&!outlineOpen.value&&layoutMode.value==='split')layoutMode.value='editor'}
function toggleTool(mode:ToolMode){if(aiApplying.value)return;if((collaborationOpen.value&&mode!=='snapshots'&&(mode!=='ai'||!aiSharedState.value?.ready))||snapshotMutating.value||memberMutating.value||(!ownerAccess.value&&['history','snapshots','figures','ai','submission','git'].includes(mode)))return;if(toolMode.value===mode){
 if(mode==='ai'&&(aiCollapsed.value||layoutMode.value==='pdf')){aiCollapsed.value=false;layoutMode.value=compactLayout.value?'editor':'split';return}
 closeTool();return
 }leaveFocus();closeTool();toolMode.value=mode;outlineOpen.value=false;layoutMode.value=mode==='ai'&&compactLayout.value?'editor':'split';if(compactLayout.value){showFiles.value=false;moreToolsOpen.value=false}refreshTool()}
function refreshTool(){if(toolMode.value==='search')void loadSearchSources();else if(toolMode.value==='references')void refreshBib();else if(toolMode.value==='history')void loadVersions();else if(toolMode.value==='snapshots')void loadSnapshots();else if(toolMode.value==='drafts')refreshLocalDrafts();else if(toolMode.value==='members'&&ownerAccess.value)void loadMembers()}
function memberError(cause:unknown){
 const code=cause instanceof ApiErrorResponseError?cause.code:''
 return code==='papers.member_ineligible'?'该账号未获得 Papers 模块访问资格或授权已过期。':code==='papers.member_limit'?'项目成员已达 20 人上限。':'成员操作失败，请确认账号 UUID、权限和网络后重试。'
}
async function loadMembers(){
 if(!ownerAccess.value)return
 const pid=projectId.value,owner=accountId.value,serial=++toolSerial
 const valid=()=>!disposed&&pid===projectId.value&&owner===accountId.value&&serial===toolSerial&&toolMode.value==='members'&&ownerAccess.value
 toolBusy.value=true;toolError.value=''
 try{const rows=await listPaperMembers(pid);if(valid())members.value=Array.isArray(rows)?rows:[]}
 catch(cause){if(valid())toolError.value=memberError(cause)}
 finally{if(valid())toolBusy.value=false}
}
async function mutateMember(action:(pid:string)=>Promise<unknown>,success:string){
 if(!ownerAccess.value||memberMutating.value||toolBusy.value||navigating.value||disposed)return
 const pid=projectId.value,owner=accountId.value,serial=++memberSerial
 const valid=()=>!disposed&&pid===projectId.value&&owner===accountId.value&&serial===memberSerial&&ownerAccess.value
 memberMutating.value=true;toolError.value='';memberMessage.value=''
 try{
  await action(pid)
  if(valid()){memberMessage.value=success;await loadMembers()}
 }catch(cause){if(valid())toolError.value=memberError(cause)}
 finally{if(valid())memberMutating.value=false}
}
async function changeMember(uid:string,role:PaperMemberRole){
 if(!ownerAccess.value||!await confirmPaper('将此账号设为'+(role==='editor'?'编辑者':'阅读者')+'？该成员将能够读取当前项目的全部源码和资源。'))return
 await mutateMember(pid=>setPaperMember(pid,uid,role),'成员权限已更新。')
}
async function deleteMember(uid:string){
 if(!ownerAccess.value||!await confirmPaper('撤销该成员的项目访问权限？'))return
 await mutateMember(pid=>removePaperMember(pid,uid),'成员访问权限已撤销。')
}
function snapshotError(cause:unknown){
 const code=cause instanceof ApiErrorResponseError?cause.code:''
 if(code==='papers.snapshot_limit')return '快照已达 30 个上限，请先删除不需要的快照。'
 if(code==='papers.revision_conflict')return collaborationOpen.value?'项目版本已变化，请等待协作同步完成后重试。':'项目版本已变化，请刷新项目后重试。'
 if(code==='papers.snapshot_unavailable')return '快照引用的历史版本缺失或损坏，操作已停止。'
 return '快照操作失败，请检查权限、网络或服务版本。'
}
async function loadSnapshots(){
 const pid=projectId.value,owner=accountId.value,serial=++toolSerial
 const valid=()=>!disposed&&pid===projectId.value&&owner===accountId.value&&ownerAccess.value&&serial===toolSerial&&toolMode.value==='snapshots'
 toolBusy.value=true;toolError.value='';snapshotDetail.value=null
 try{const rows=await listPaperProjectSnapshots(pid);if(valid())snapshots.value=Array.isArray(rows)?rows:[]}
 catch(cause){if(valid())toolError.value=snapshotError(cause)}
 finally{if(valid())toolBusy.value=false}
}
async function previewSnapshot(id:string){
 if(snapshotMutating.value)return
 const pid=projectId.value,owner=accountId.value,serial=++toolSerial
 const valid=()=>!disposed&&pid===projectId.value&&owner===accountId.value&&ownerAccess.value&&serial===toolSerial&&toolMode.value==='snapshots'
 toolBusy.value=true;toolError.value='';snapshotDetail.value=null
 try{const row=await getPaperProjectSnapshot(pid,id);if(valid()&&row.id===id)snapshotDetail.value=row}
 catch(cause){if(valid())toolError.value=snapshotError(cause)}
 finally{if(valid())toolBusy.value=false}
}
function snapshotBlocked(){
 return !ownerAccess.value||(collaborationOpen.value&&currentCollaborationRevision()===null)||snapshotMutating.value||uploadBusy.value||toolBusy.value||switchingFile.value||navigating.value||saving.value||hasActiveCompile.value||compiling.value||!project.value||disposed
}
async function runSnapshotMutation(action:(pid:string,revision:number)=>Promise<void>,flush=true){
 if(snapshotBlocked())return
 const pid=projectId.value,owner=accountId.value,collaborating=collaborationOpen.value
 snapshotMutating.value=true;addingFile.value=true;toolError.value='';snapshotMessage.value=''
 try{
  await nextTick()
  if(!collaborating&&flush&&!await persist()){toolError.value='请先解决未保存源码或版本冲突，未执行快照操作。';return}
  if(disposed||pid!==projectId.value||owner!==accountId.value||collaborating!==collaborationOpen.value||navigating.value||!project.value||!ownerAccess.value)return
  const revision=collaborating?currentCollaborationRevision():project.value.head_revision
  if(!revision){toolError.value='请等待协作修改得到服务器确认后重试。';return}
  await action(pid,revision)
 }catch(cause){if(!disposed&&pid===projectId.value&&owner===accountId.value)toolError.value=snapshotError(cause)}
 finally{if(pid===projectId.value&&owner===accountId.value){snapshotMutating.value=false;addingFile.value=false;scheduleAuto()}}
}
async function createSnapshot(name:string){
 const owner=accountId.value
 await runSnapshotMutation(async (pid,revision)=>{
  await createPaperProjectSnapshot(pid,name,revision)
  if(disposed||pid!==projectId.value||owner!==accountId.value)return
  snapshotMessage.value=collaborationOpen.value?'项目快照已创建 · 版本 '+revision+'。':'项目快照已创建。'
  await loadSnapshots()
 })
}
async function deleteSnapshot(row:PaperProjectSnapshot){
 if(snapshotBlocked()||!await confirmPaper('删除快照「'+row.name+'」？不会删除文件历史或当前源码。'))return
 const owner=accountId.value
 await runSnapshotMutation(async pid=>{
  await deletePaperProjectSnapshot(pid,row.id)
  if(disposed||pid!==projectId.value||owner!==accountId.value)return
  snapshotMessage.value='快照已删除。'
  await loadSnapshots()
 },false)
}
async function restoreSnapshot(row:PaperSnapshotDetail){
 if(collaborationOpen.value||snapshotBlocked()||!await confirmPaper('恢复整个项目至「'+row.name+'」？将恢复文件、资源、路径和主文件设置。当前服务器状态会先保存为自动备份，其他窗口的本机草稿不会被覆盖。'))return
 await runSnapshotMutation(async pid=>{
  const result=await restorePaperProjectSnapshot(pid,row.id,project.value!.head_revision)
  if(disposed||pid!==projectId.value)return
  // The transaction has committed. Clear the old editor immediately so no
  // stale local content can be written against the new server revisions.
  fileSerial++;searchBase.value=0;searchSources.value=[];outlineCache.value=[];managedFile.value=null
  pendingSubmission=null;clearAuto();autoDirty=false;autoCompile.value=false
  project.value=result.project;files.value=result.files;activeFile.value=null;draft.value=''
  saveStatus.value='已恢复项目';saveError.value='';recommendedCompiler.value=undefined
  snapshotMessage.value='项目已恢复，回滚前状态已自动保存为快照。'
  refreshLocalDrafts()
  const main=result.files.find(f=>f.id===result.project.main_file_id)
  try{
   if(main){
    const content=await getPaperFile(pid,main.id)
    if(disposed||pid!==projectId.value)return
    if(content.id!==main.id||content.revision!==main.revision)throw new Error('Restored file changed')
    activeFile.value=content;draft.value=content.kind==='text'?content.content:'';revealFile(content.path)
    if(content.kind==='text'){recommendedCompiler.value=recommendedTexCompiler(content.content);if(recommendedCompiler.value&&compilerOptions.value.includes(recommendedCompiler.value))selectedCompiler.value=recommendedCompiler.value}
   }
  }catch{if(!disposed&&pid===projectId.value)fileError.value='项目已恢复，但重新读取主文件失败。请从文件栏重新打开文件。'}
  if(!disposed&&pid===projectId.value)await loadSnapshots()
 })
}
async function readToolFiles(targets:PaperFile[],pid:string,valid:()=>boolean){
 const output:PaperFile[]=[]
 const encoder=new TextEncoder();let bytes=0
 for(let i=0;i<targets.length;i+=4){
  const group=await Promise.all(targets.slice(i,i+4).map(f=>getPaperFile(pid,f.id)))
  if(!valid())return null
  for(const [index,file] of group.entries()){
   const expected=targets[i+index]
   if(!expected||file.id!==expected.id||file.kind!=='text'||file.revision!==expected.revision)throw new Error('项目已有变化，请刷新页面后重试。')
   bytes+=encoder.encode(file.content).byteLength
   if(bytes>4*1024*1024)throw new Error('源码超过项目工具读取容量限制。')
   output.push(file)
  }
 }
 return output
}
async function refreshBib(){
 const serial=++bibSerial,pid=projectId.value
 const targets=files.value.filter(f=>f.kind==='text'&&/\.bib$/i.test(f.path))
 bibError.value='';bibSources.value=bibSources.value.filter(f=>targets.some(t=>t.id===f.id&&t.revision===f.revision))
 try{
  const rows=await readToolFiles(targets,pid,()=>!disposed&&serial===bibSerial&&pid===projectId.value)
  if(rows&&!disposed&&serial===bibSerial&&pid===projectId.value)bibSources.value=rows
 }catch{if(!disposed&&serial===bibSerial&&pid===projectId.value){bibSources.value=[];bibError.value='参考文献读取失败，请刷新。'}}
}
watch(()=>files.value.filter(f=>f.kind==='text'&&/\.bib$/i.test(f.path)).map(f=>f.id+':'+f.revision).join('|'),()=>void refreshBib())
async function loadSearchSources(){
 if(toolMode.value!=='search')return
 const serial=++toolSerial,pid=projectId.value
 const valid=()=>!disposed&&serial===toolSerial&&pid===projectId.value&&toolMode.value==='search'
 toolBusy.value=true;toolError.value='';searchBase.value=0;searchSources.value=[]
 try{
  if(!await persist())throw new Error('请先解决源码保存问题。')
  if(!valid()||!project.value)return
  const base=project.value.head_revision
  const rows=await readToolFiles(files.value.filter(f=>f.kind==='text'),pid,valid)
  if(!rows||!valid())return
  if(base!==project.value.head_revision)throw new Error('项目已有变化，请刷新搜索。')
  searchSources.value=rows;searchBase.value=base
 }catch(cause){if(valid())toolError.value=cause instanceof Error?cause.message:'项目搜索失败，请重试。'}
 finally{if(valid())toolBusy.value=false}
}
async function jumpSearch(hit:ProjectMatch){
 if(searchStale.value)return
 const file=files.value.find(f=>f.id===hit.fileId&&f.revision===hit.revision)
 if(!file)return
 await selectFile(file);await nextTick()
 if(activeFile.value?.id===hit.fileId&&activeFile.value.revision===hit.revision){revealSource();await nextTick();editorRef.value?.goToMatch(hit.line,hit.column,searchQuery.value.length)}
}
async function appendReferences(targetId:string,raw:string):Promise<boolean>{
 const pid=projectId.value,owner=accountId.value,base=project.value?.head_revision,prior=activeFile.value,manifest=projectFileFence(files.value)
 if(!base||!prior)return false
 const valid=()=>!disposed&&!!owner&&owner===accountId.value&&pid===projectId.value&&project.value?.id===pid&&project.value?.head_revision===base&&manifest===projectFileFence(files.value)&&ownerAccess.value&&toolMode.value==='references'&&!collaborationOpen.value&&!navigating.value&&!saving.value&&!savePromise&&!switchingFile.value&&!snapshotMutating.value&&!memberMutating.value&&!compiling.value&&!hasActiveCompile.value&&!preparingUpload.value&&activeFile.value?.id===prior.id&&activeFile.value.revision===prior.revision&&(prior.kind!=='text'||draft.value===prior.content)
 if(!valid()||uploadBusy.value)return false
 const bibFiles=files.value.filter(f=>f.kind==='text'&&/\.bib$/i.test(f.path))
 if(targetId==='new'?(bibFiles.length!==0||files.value.some(f=>f.path==='references.bib')):!bibFiles.some(f=>f.id===targetId))return false
 toolError.value=''
 try{
  const rows=await readProjectText(bibFiles,base,id=>getPaperFile(pid,id),valid)
  if(!valid()||uploadBusy.value)return false
  const current=rows.find(f=>f.id===targetId)
  if(targetId!=='new'&&!current)return false
  const plan=planBibtexAppend(current?.content||'',raw,rows.flatMap(r=>existingBibtexKeys(r.content)))
  if(!await confirmPaper('将 '+plan.keys.length+' 条 BibTeX 文献导入 '+(current?.path||'references.bib')+'？仅追加条目，不自动插入正文引用。'))return false
  if(!valid()||uploadBusy.value)return false
  addingFile.value=true;clearAuto()
  try{
   await nextTick()
   if(!valid())return false
   const result=current?await managePaperFiles(pid,{action:'replace_text',base_revision:base,replacements:[{file_id:current.id,base_revision:current.revision,content:plan.content}]}):await managePaperFiles(pid,{action:'upload',base_revision:base,uploads:[{path:'references.bib',kind:'text',content:plan.content}]})
   if(!valid())return false
   const saved=result.files.find(f=>f.path===(current?.path||'references.bib')&&f.kind==='text')
   if(result.project.id!==pid||result.project.head_revision!==base+1||!saved||(current&&(saved.id!==current.id||saved.revision!==current.revision+1)))throw Error('Unexpected import result')
   const updated=result.files.find(f=>f.id===prior.id)
   if(!updated)throw Error('Active file missing')
   project.value={...result.project,access_role:'owner'};files.value=result.files
   const content=updated.id===saved.id?plan.content:prior.content
   activeFile.value={...updated,content};draft.value=content;saveStatus.value='已保存';autoDirty=true
   await refreshBib()
   return true
  }finally{if(pid===projectId.value&&owner===accountId.value){addingFile.value=false;scheduleAuto()}}
 }catch(e){if(pid===projectId.value&&owner===accountId.value&&!disposed)toolError.value=e instanceof Error&&e.message.startsWith('项目已有引用键')?e.message:'参考文献导入未确认，请刷新项目并检查引用键。';return false}
}
async function jumpReference(entry:PaperReference){
 const file=files.value.find(f=>f.id===entry.fileId)
 if(!file)return
 await selectFile(file);await nextTick()
 if(activeFile.value?.id===entry.fileId){revealSource();await nextTick();editorRef.value?.goToLine(entry.line)}
}
async function replaceProject(){
 if(!ownerAccess.value||toolBusy.value||uploadBusy.value||switchingFile.value||navigating.value||searchStale.value||!project.value)return
 const pid=projectId.value,base=searchBase.value
 let replacements
 try{replacements=planProjectReplacement(searchSources.value,searchQuery.value,replaceQuery.value)}
 catch(cause){toolError.value=cause instanceof Error?cause.message:'替换内容无效。';return}
 if(!replacements.length)return
 if(!await confirmPaper('将替换 '+replacements.length+' 个文件中的 '+searchResult.value.total+' 处文字？原版本将保留在历史中。'))return
 addingFile.value=true;toolError.value=''
 try{
  await nextTick()
  if(disposed||pid!==projectId.value||searchStale.value||navigating.value)return
  const result=await managePaperFiles(pid,{action:'replace_text',base_revision:base,replacements})
  if(disposed||pid!==projectId.value)return
  project.value=result.project;files.value=result.files
  const prior=activeFile.value
  if(prior){
   const updated=result.files.find(f=>f.id===prior.id)
   const change=replacements.find(f=>f.file_id===prior.id)
   if(updated){const content=change?.content??prior.content;activeFile.value={...updated,content};draft.value=content;saveStatus.value='已保存'}
  }
  autoDirty=true
  if(outlineOpen.value)void loadOutline()
 }catch(cause){if(!disposed&&pid===projectId.value){toolError.value=managementError(cause);searchBase.value=0}}
 finally{if(pid===projectId.value){addingFile.value=false;scheduleAuto();if(searchBase.value&&toolMode.value==='search')void loadSearchSources()}}
}
async function loadVersions(append=false){
 const file=activeFile.value,pid=projectId.value,serial=++toolSerial
 if(toolMode.value!=='history'||file?.kind!=='text'){fileVersions.value=[];selectedVersion.value=null;moreVersions.value=false;toolBusy.value=false;return}
 const valid=()=>!disposed&&serial===toolSerial&&pid===projectId.value&&activeFile.value?.id===file.id&&toolMode.value==='history'
 toolBusy.value=true;toolError.value=''
 if(!append){fileVersions.value=[];selectedVersion.value=null;moreVersions.value=false}
 try{
  const rows=await listPaperFileVersions(pid,file.id,append?fileVersions.value.at(-1)?.revision:undefined)
  if(valid()){fileVersions.value=append?[...fileVersions.value,...rows]:rows;moreVersions.value=rows.length===50}
 }catch{if(valid())toolError.value='无法读取文件历史，请重试。'}
 finally{if(valid())toolBusy.value=false}
}
async function previewVersion(version:PaperVersionSummary){
 const file=activeFile.value,pid=projectId.value,serial=++toolSerial
 if(!file||toolMode.value!=='history')return
 const valid=()=>!disposed&&serial===toolSerial&&pid===projectId.value&&activeFile.value?.id===file.id&&toolMode.value==='history'
 toolBusy.value=true;toolError.value='';selectedVersion.value=null
 try{const row=await getPaperFileVersion(pid,file.id,version.revision);if(valid()&&row.file_id===file.id&&row.revision===version.revision)selectedVersion.value=row}
 catch{if(valid())toolError.value='无法读取历史源码。'}
 finally{if(valid())toolBusy.value=false}
}
watch(()=>activeFile.value?.id,()=>{if(toolMode.value==='history')void loadVersions()})
async function restoreVersion(){
 const version=selectedVersion.value,file=activeFile.value,pid=projectId.value
 if(!ownerAccess.value||!version||!file||version.file_id!==file.id||uploadBusy.value||toolBusy.value||switchingFile.value||navigating.value)return
 if(!await confirmPaper('恢复历史源码？当前已保存版本会继续保留，恢复将创建一个新版本，不修改文件路径。'))return
 addingFile.value=true;toolError.value=''
 try{
  await nextTick()
  if(!await persist()||disposed||pid!==projectId.value||activeFile.value?.id!==file.id||navigating.value)return
  draft.value=version.content
  if(await persist()&&toolMode.value==='history')await loadVersions()
 }finally{if(pid===projectId.value){addingFile.value=false;scheduleAuto()}}
}

type OutlineRow=LatexHeading&{fileId:string;path:string;revision:number}
const outlineOpen=ref(false),outlineLoading=ref(false)
const outlineCache=shallowRef<OutlineRow[]>([])
let outlineSerial=0
const outlineRows=computed(()=>{
 const a=activeFile.value
 const rest=outlineCache.value.filter(x=>x.fileId!==a?.id&&files.value.some(f=>f.id===x.fileId&&f.revision===x.revision))
 const local=a?.kind==='text'&&/\.tex$/i.test(a.path)?latexHeadings(draft.value).map(h=>({...h,fileId:a.id,path:a.path,revision:a.revision})):[]
 const main=project.value?.main_file_id
 return [...rest,...local].sort((x,y)=>(x.fileId===main?-1:0)-(y.fileId===main?-1:0)||x.path.localeCompare(y.path)||x.line-y.line).slice(0,600)
})
async function loadOutline(){
 const serial=++outlineSerial,pid=projectId.value
 outlineLoading.value=true
 const collected:OutlineRow[]=[]
 try{
  const targets=files.value.filter(f=>f.kind==='text'&&/\.tex$/i.test(f.path))
  for(let i=0;i<targets.length;i+=4){
   const group=await Promise.allSettled(targets.slice(i,i+4).map(f=>getPaperFile(pid,f.id)))
   if(disposed||serial!==outlineSerial||pid!==projectId.value)return
   for(const result of group)if(result.status==='fulfilled'){
    const f=result.value
    for(const h of latexHeadings(f.content)){if(collected.length>=600)break;collected.push({...h,fileId:f.id,path:f.path,revision:f.revision})}
   }
  }
  if(serial===outlineSerial)outlineCache.value=collected
 }finally{if(serial===outlineSerial)outlineLoading.value=false}
}
function toggleOutline(){if(aiApplying.value)return;if(!outlineOpen.value){leaveFocus();closeTool();outlineOpen.value=true;layoutMode.value='split';if(compactLayout.value)showFiles.value=false;void loadOutline()}else{outlineOpen.value=false;if(compactLayout.value)layoutMode.value='editor'}}
async function jumpOutline(item:OutlineRow){
 const target=files.value.find(f=>f.id===item.fileId)
 if(!target)return
 if(target.id!==activeFile.value?.id&&target.revision!==item.revision){fileError.value='大纲已过期，请刷新。';return}
 if(layoutMode.value==='pdf')layoutMode.value=compactLayout.value?'editor':'split'
 if(aiPanelOpen.value)aiExpanded.value=false
 await selectFile(target);await nextTick()
 if(activeFile.value?.id===target.id&&activeFile.value.revision===item.revision){revealSource();await nextTick();editorRef.value?.goToLine(item.line)}
}

const newFilePath = ref('')
const saveStatus = ref('尚未打开文件')
const compileEnabled = ref(false)
const compilerOptions=ref<PaperCompiler[]>(['pdflatex'])
const selectedCompiler=ref<PaperCompiler>('pdflatex')
const recommendedCompiler=ref<PaperCompiler|undefined>(undefined)
const recommendedUnavailable=computed(()=>!!recommendedCompiler.value&&(!compileEnabled.value||!compilerOptions.value.includes(recommendedCompiler.value)))
let compilerChangedByUser=false
function compilerLabel(engine?:PaperCompiler){return engine==='xelatex'?'XeLaTeX':engine==='lualatex'?'LuaLaTeX':'pdfLaTeX'}
function compilerChanged(){compilerChangedByUser=true;autoDirty=true;scheduleAuto()}

const pdfEnabled = ref(false)
const compileJob = ref<PaperCompileJob | null>(null)
const previewJob = ref<PaperCompileJob | null>(null)
const submissionPDF=ref<{jobId:string;revision:number;pages:number}|null>(null)
const sharedPreviewBusy=ref(false),sharedPreviewError=ref('')
let sharedPreviewSerial=0
async function loadSharedPreview(){
 if(disposed||ownerAccess.value||!project.value||sharedPreviewBusy.value)return
 const pid=projectId.value,account=accountId.value,n=++sharedPreviewSerial,load=loadSerial
 const valid=()=>!disposed&&n===sharedPreviewSerial&&load===loadSerial&&pid===projectId.value&&account===accountId.value&&!ownerAccess.value
 sharedPreviewBusy.value=true;sharedPreviewError.value=''
 try{
  const job=await getPaperSharedPreview(pid)
  if(!valid())return
  previewJob.value=job?.project_id===pid&&job.status==='succeeded'&&job.pdf_available?job:null
  pdfEnabled.value=!!previewJob.value
 }catch{
  if(valid()){previewJob.value=null;pdfEnabled.value=false;sharedPreviewError.value='暂时无法读取共享 PDF，请检查项目权限后刷新。'}
 }finally{if(n===sharedPreviewSerial)sharedPreviewBusy.value=false}
}
function resetSharedPreview(){sharedPreviewSerial++;sharedPreviewBusy.value=false;sharedPreviewError.value=''}
const showDiagnostics=ref(false)
const diagnostics=computed(()=>(compileJob.value?.diagnostics||[]).slice(0,12))
const diagnosticStale=computed(()=>collaborationOpen.value||compileJob.value?.source_revision!==project.value?.head_revision || (activeFile.value?.kind==='text'&&draft.value!==activeFile.value.content))
watch(()=>[compileJob.value?.id,compileJob.value?.status],()=>{showDiagnostics.value=compileJob.value?.status==='failed'})
function failureMessage(code:string){
 const labels:Record<string,string>={
  compile_failed:'LaTeX 源码编译错误',
  runtime_failed:'编译运行失败',
  isolation_failed:'编译环境初始化失败',
  artifact_missing:'未生成有效 PDF',
  timed_out:'编译超时',
  resource_exhausted_pids:'编译进程超过限制',
  resource_exhausted_memory:'编译内存超过限制',
  resource_exhausted_ambiguous:'编译资源超过限制',
  verified_pdf_not_persisted:'PDF 保存失败',
  cleanup_failed:'编译环境回收异常',
  owner_canceled:'任务已取消',
  cancel_requested:'任务已取消',
  access_revoked:'项目访问权限已撤销'
 }
 return labels[code]||'编译未成功'
}
async function jumpDiagnostic(item:PaperCompileDiagnostic){
 if(aiApplying.value||aiRepairActive.value||!item.file||!item.line||diagnosticStale.value)return
 const target=files.value.find(f=>f.path===item.file&&f.kind==='text')
 if(!target){syncMessage.value='当前项目中找不到对应源文件。';return}
 const jobId=compileJob.value?.id
 if(layoutMode.value==='pdf')layoutMode.value=compactLayout.value?'editor':'split'
 if(aiPanelOpen.value)aiExpanded.value=false
 await selectFile(target)
 await nextTick()
 if(jobId===compileJob.value?.id&&!diagnosticStale.value&&activeFile.value?.id===target.id)editorRef.value?.goToLine(item.line)
}

const previewStale = computed(() => !!previewJob.value && (previewJob.value.id !== compileJob.value?.id ||
 previewJob.value.source_revision !== (collaborationOpen.value?collaborationRevision.value:project.value?.head_revision) ||
 (previewJob.value.compiler||'pdflatex')!==selectedCompiler.value ||
 (!collaborationOpen.value&&activeFile.value?.kind === 'text' && draft.value !== activeFile.value.content)))
const editorRef=ref<InstanceType<typeof LatexEditor>|null>(null)
function captureAISelection(){return collaborationOpen.value?(collaborationRef.value?.getAISelection?.()??null):(editorRef.value?.getAISelection?.()??null)}
async function applyAIProject(base:number,replacements:PaperTextReplacement[],repairFence?:RepairApplyFence,proposalId?:string):Promise<boolean>{
 const pid=projectId.value,owner=accountId.value
 const prior=activeFile.value
 const valid=()=>!disposed&&!!owner&&owner===accountId.value&&pid===projectId.value&&project.value?.id===pid&&ownerAccess.value&&toolMode.value==='ai'&&!collaborationOpen.value&&!navigating.value&&!saving.value&&!savePromise&&!switchingFile.value&&!snapshotMutating.value&&!memberMutating.value&&!compiling.value&&!hasActiveCompile.value&&
  project.value?.head_revision===base&&(!repairFence||(aiRepairActive.value&&validRepairApplyFence(compileJob.value,{projectId:pid,revision:base,compiler:selectedCompiler.value},repairFence)))&&!!prior&&activeFile.value?.id===prior.id&&activeFile.value.revision===prior.revision&&draft.value===prior.content&&activeFile.value.content===prior.content&&replacements.every(change=>files.value.some(f=>f.id===change.file_id&&f.kind==='text'&&f.revision===change.base_revision))
 if(!valid()||uploadBusy.value||aiApplying.value||!replacements.length||replacements.length>5||new Set(replacements.map(row=>row.file_id)).size!==replacements.length)return false
 if(!await confirmPaper('将原子提交 '+replacements.length+' 个已审阅文件的修改？原版本会保留；普通文件管理写入可能使其他协作者的旧会话失效。'))return false
 if(!valid()||uploadBusy.value)return false
 aiApplying.value=true;addingFile.value=true;clearAuto()
 try{
  await nextTick()
  if(!valid())return false
  const result=await managePaperFiles(pid,{action:proposalId?'ai_apply':'replace_text',base_revision:base,replacements,...(proposalId?{ai_event_id:proposalId}:{})})
  if(disposed||pid!==projectId.value||owner!==accountId.value)return false
  if((proposalId&&!result.ai_event_id)||result.project.id!==pid||result.project.head_revision!==base+1||replacements.some(change=>!result.files.some(f=>f.id===change.file_id&&f.revision===change.base_revision+1)))throw Error('Unexpected project response')
  if(!valid())return false
  const updated=result.files.find(f=>f.id===prior?.id)
  if(prior&&!updated)throw Error('Active file missing')
  project.value={...result.project,access_role:'owner'};files.value=result.files
  if(prior&&updated){
   const change=replacements.find(row=>row.file_id===prior.id)
   const content=change?.content??prior.content
   activeFile.value={...updated,content};draft.value=content
   saveStatus.value='已保存';saveError.value=''
  }
  autoDirty=true
  return true
 }catch{return false}
 finally{if(pid===projectId.value&&owner===accountId.value){aiApplying.value=false;addingFile.value=false;scheduleAuto()}}
}
async function rollbackAIActivity(event:PaperAIActivity):Promise<boolean>{
 const pid=projectId.value,owner=accountId.value,base=project.value?.head_revision,prior=activeFile.value
 if(!base||!prior||event.action!=='papers.ai.applied'||!event.id||!event.files.length||event.files.length>5||new Set(event.files.map(f=>f.file_id)).size!==event.files.length)return false
 const valid=()=>!disposed&&!!owner&&owner===accountId.value&&pid===projectId.value&&project.value?.id===pid&&project.value?.head_revision===base&&ownerAccess.value&&toolMode.value==='ai'&&!collaborationOpen.value&&!aiRepairActive.value&&!navigating.value&&!saving.value&&!savePromise&&!switchingFile.value&&!snapshotMutating.value&&!memberMutating.value&&!compiling.value&&!hasActiveCompile.value&&!preparingUpload.value&&activeFile.value?.id===prior.id&&activeFile.value.revision===prior.revision&&draft.value===prior.content&&activeFile.value.content===prior.content&&event.files.every(change=>files.value.some(f=>f.id===change.file_id&&f.kind==='text'&&f.revision===change.after_revision))
 if(!valid()||aiApplying.value||addingFile.value)return false
 if(!await confirmPaper('回滚这次 AI 操作涉及的 '+event.files.length+' 个文件？仅在这些文件之后没有修改时恢复原版本，并创建新的版本记录；其他文件不受影响。普通文件管理写入可能使协作会话失效。'))return false
 if(!valid()||aiApplying.value||addingFile.value)return false
 aiApplying.value=true;addingFile.value=true;clearAuto()
 try{
  await nextTick()
  if(!valid())return false
  const affected=event.files.find(f=>f.file_id===prior.id)
  // Read the immutable before-version for the currently visible file only.
  const original=affected?await getPaperFileVersion(pid,prior.id,affected.before_revision):null
  if(!valid()||(affected&&(!original||original.file_id!==prior.id||original.revision!==affected.before_revision||original.path!==prior.path)))return false
  const result=await managePaperFiles(pid,{action:'ai_rollback',base_revision:base,ai_event_id:event.id})
  if(disposed||pid!==projectId.value||owner!==accountId.value)return false
  if(!result.ai_event_id||result.project.id!==pid||result.project.head_revision!==base+1||event.files.some(change=>!result.files.some(f=>f.id===change.file_id&&f.revision===change.after_revision+1)))throw Error('Unexpected rollback response')
  if(!valid())return false
  const updated=result.files.find(f=>f.id===prior.id)
  if(!updated||(original&&updated.sha256!==original.sha256))throw Error('Unexpected rollback file')
  project.value={...result.project,access_role:'owner'};files.value=result.files
  const content=original?.content??prior.content
  activeFile.value={...updated,content};draft.value=content
  saveStatus.value='已回滚为新版本';saveError.value=''
  autoDirty=true
  return true
 }catch{return false}
 finally{if(pid===projectId.value&&owner===accountId.value){aiApplying.value=false;addingFile.value=false;scheduleAuto()}}
}
function applyAIEdit(edit:PaperAIEdit){
 if(disposed||!ownerAccess.value||saving.value||navigating.value||switchingFile.value||uploadBusy.value||addingFile.value||snapshotMutating.value||compiling.value||
    activeFile.value?.kind!=='text'||activeFile.value.id!==edit.fileId)return false
 if(collaborationOpen.value){
  if(collaborationAccount.value!==accountId.value)return false
  return collaborationRef.value?.acceptAIEdit?.(edit)===true
 }
 if(edit.collaborationEpoch||activeFile.value.revision!==edit.revision||draft.value!==edit.baseline)return false
 return editorRef.value?.acceptAIEdit?.(edit)===true
}
const pdfRef=ref<InstanceType<typeof PaperPDFPreview>|null>(null)
const sourceMap=shallowRef<PaperSourceMap|null>(null)
const mapJob=ref('')
const displayedPDFJob=ref('')
const syncMessage=ref('')
let mapAbort:AbortController|undefined
let mapSerial=0
const syncReady=computed(()=>ownerAccess.value&&!collaborationOpen.value&&!aiRepairActive.value&&!aiApplying.value&&!!sourceMap.value&&!!previewJob.value&&mapJob.value===previewJob.value.id&&displayedPDFJob.value===mapJob.value&&previewJob.value.source_revision===project.value?.head_revision&&draft.value===activeFile.value?.content)
watch(()=>[projectId.value,previewJob.value?.id] as const,async ([pid,jid])=>{
 const serial=++mapSerial;mapAbort?.abort();mapAbort=new AbortController()
 sourceMap.value=null;mapJob.value='';syncMessage.value=''
 if(!jid||!ownerAccess.value)return
 try{
  const raw=await getPaperCompileSourceMap(pid,jid,mapAbort.signal)
  if(serial!==mapSerial||disposed||projectId.value!==pid)return
  sourceMap.value=decodeSourceMap(raw);mapJob.value=sourceMap.value?jid:''
 }catch{if(serial===mapSerial&&!disposed)sourceMap.value=null}
})
function checkSync(){
 if(!syncReady.value){syncMessage.value=previewJob.value?.source_revision!==project.value?.head_revision||draft.value!==activeFile.value?.content?'源码已更新，请重新编译后再定位。':'此 PDF 尚无定位数据，请重新编译。';return false}
 return true
}
async function jumpToPDF(){
 if(!checkSync()||!sourceMap.value||!activeFile.value)return
 const p=sourceToPDF(sourceMap.value,activeFile.value.path,editorRef.value?.getLine?.()||1, pdfRef.value?.page||1)
 if(!p){syncMessage.value='当前源码行没有对应的 PDF 内容。';return}
 if(sideToolOpen.value||layoutMode.value==='editor')setWorkspaceLayout(compactLayout.value?'pdf':'split')
 await nextTick()
 if(!await pdfRef.value?.showPosition(p[2],p[3]/10,p[4]/10,mapJob.value)){syncMessage.value='PDF 正在更新，请稍后再定位。';return}
 syncMessage.value=''
}
async function jumpFromPDF(pos:{jobId:string;page:number;x:number;y:number}){
 if(!checkSync()||!sourceMap.value||pos.jobId!==mapJob.value)return
 const p=pdfToSource(sourceMap.value,pos.page,pos.x,pos.y)
 if(!p){syncMessage.value='这个位置没有可定位的源码。';return}
 const target=files.value.find(f=>f.path===sourceMap.value?.files[p[0]]&&f.kind==='text')
 if(!target){syncMessage.value='没有找到对应的项目源文件。';return}
 if(layoutMode.value==='pdf')layoutMode.value=compactLayout.value?'editor':'split'
 if(aiPanelOpen.value)aiExpanded.value=false
 await selectFile(target)
 await nextTick()
 if(activeFile.value?.id===target.id&&syncReady.value&&pos.jobId===mapJob.value){editorRef.value?.goToLine?.(p[1]);syncMessage.value=''}
}
function jumpToCode(){const pos=pdfRef.value?.currentPosition();if(pos)void jumpFromPDF(pos)}

const workspaceRoot=ref<HTMLElement|null>(null)
const sourceColumn=ref<HTMLElement|null>(null)
const PANEL_PREFS_KEY='atoman.papers.layout.v1'
function readPanelPrefs():{files:number;preview:number;ai:number}{
 try{
  const data=JSON.parse(localStorage.getItem(PANEL_PREFS_KEY)||'null')
  return {files:typeof data?.files==='number'&&Number.isFinite(data.files)?Math.max(180,Math.min(420,data.files)):248,preview:typeof data?.preview==='number'&&Number.isFinite(data.preview)?Math.max(25,Math.min(75,data.preview)):49,ai:typeof data?.ai==='number'&&Number.isFinite(data.ai)?Math.max(25,Math.min(70,Math.round(data.ai))):43}
 }catch{return {files:248,preview:49,ai:43}}
}
const panelPrefs=readPanelPrefs()
const previewWidth=ref(panelPrefs.preview)
const filesWidth=ref(panelPrefs.files)
const aiHeight=ref(panelPrefs.ai)
function resizeAI(value:number){aiHeight.value=Math.max(25,Math.min(70,Math.round(value)))}
let draggingAI=false
function beginAIResize(e:PointerEvent){draggingAI=true;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);moveAIResize(e)}
function moveAIResize(e:PointerEvent){
 if(!draggingAI||!sourceColumn.value)return
 const r=sourceColumn.value.getBoundingClientRect()
 if(r.height>0)resizeAI((r.bottom-e.clientY)/r.height*100)
}
function endAIResize(){draggingAI=false}
const maxFilesWidth=()=>Math.max(180,Math.min(420,(workspaceRoot.value?.clientWidth||1200)-600))
function resizeFiles(value:number){filesWidth.value=Math.max(180,Math.min(maxFilesWidth(),value))}
function resizePreview(value:number){
 const full=workspaceRoot.value?.clientWidth||1200
 const sidebar=showFiles.value?(workspaceRoot.value?.querySelector('.papers-workspace__files')?.clientWidth||filesWidth.value):0
 const available=Math.max(1,full-sidebar-12)
 const min=Math.max(25,Math.min(50,280/available*100))
 previewWidth.value=Math.max(min,Math.min(100-min,value))
}
function resetPanelWidths(){filesWidth.value=248;previewWidth.value=49;resizeFiles(248);resizePreview(49)}
watch([filesWidth,previewWidth,aiHeight],([files,preview,ai])=>{try{localStorage.setItem(PANEL_PREFS_KEY,JSON.stringify({files,preview,ai}))}catch{/* layout storage is optional */}})
let draggingFilesDivider=false
function beginFilesResize(e:PointerEvent){draggingFilesDivider=true;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);moveFilesResize(e)}
function moveFilesResize(e:PointerEvent){if(!draggingFilesDivider||!workspaceRoot.value)return;resizeFiles(e.clientX-workspaceRoot.value.getBoundingClientRect().left)}
function endFilesResize(){draggingFilesDivider=false}
const isCompactViewport=()=>typeof window!=='undefined'&&(window.innerWidth<900||document.documentElement.dataset.atomanApp==='mobile')
const compactLayout=ref(isCompactViewport())
const moreToolsOpen=ref(false)
const showFiles=ref(!compactLayout.value)
const layoutMode=ref<'split'|'editor'|'pdf'>(compactLayout.value?'editor':'split')
const focusMode=ref(false)
let previousFocusLayout:{mode:'split'|'editor'|'pdf';files:boolean}|null=null
const desktopRail=computed(()=>!compactLayout.value&&!focusMode.value&&!!project.value&&!loading.value&&!error.value&&!collaborationOpen.value)
function leaveFocus(){
 if(!focusMode.value)return
 focusMode.value=false
 if(previousFocusLayout){layoutMode.value=previousFocusLayout.mode;showFiles.value=previousFocusLayout.files}
 previousFocusLayout=null
}
function toggleFocus(){
 if(focusMode.value){leaveFocus();return}
 if(compactLayout.value||auxiliaryOpen.value||collaborationOpen.value||!project.value||loading.value||error.value)return
 previousFocusLayout={mode:layoutMode.value,files:showFiles.value}
 focusMode.value=true;showFiles.value=false;layoutMode.value='editor'
}
function toggleFilePane(){if(focusMode.value){leaveFocus();showFiles.value=true}else showFiles.value=!showFiles.value}
watch([projectId,accountId],leaveFocus)
function setWorkspaceLayout(mode:'split'|'editor'|'pdf'){
 if(aiApplying.value||snapshotMutating.value||memberMutating.value)return
 leaveFocus();if(!aiPanelOpen.value)closeTool();outlineOpen.value=false;aiExpanded.value=false
 layoutMode.value=compactLayout.value&&mode==='split'?'editor':mode
 if(compactLayout.value)showFiles.value=false
}
async function compileAndShowPDF(){setWorkspaceLayout(compactLayout.value?'pdf':'split');await nextTick();await compileNow()}
function revealSource(){if(compactLayout.value)setWorkspaceLayout('editor')}
async function insertReference(key:string){if(!writeAccess.value)return;if(compactLayout.value){revealSource();await nextTick()}editorRef.value?.insertCitation(key)}
function onViewportChange(){const small=isCompactViewport();if(small===compactLayout.value){if(!small){resizeFiles(filesWidth.value);resizePreview(previewWidth.value)}return;}if(small)leaveFocus();compactLayout.value=small;showFiles.value=!small;moreToolsOpen.value=false;if(small&&!sideToolOpen.value&&layoutMode.value==='split')layoutMode.value='editor';if(!small&&auxiliaryOpen.value&&layoutMode.value!=='pdf')layoutMode.value='split';aiExpanded.value=false}
const autoCompile=ref(false)
let dragging=false
let autoTimer:ReturnType<typeof setTimeout>|null=null
let lastAutoCompile=0
let autoDirty=false
function beginResize(e:PointerEvent){dragging=true;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);resizeMove(e)}
function resizeMove(e:PointerEvent){
 if(!dragging||!workspaceRoot.value)return
 const r=workspaceRoot.value.getBoundingClientRect()
 const filesWidth=showFiles.value?(workspaceRoot.value.querySelector('.papers-workspace__files')?.clientWidth||0):0
 resizePreview((r.right-e.clientX)/Math.max(1,r.width-filesWidth)*100)
}
function endResize(){dragging=false}
function clearAuto(){if(autoTimer)clearTimeout(autoTimer);autoTimer=null}
function scheduleAuto(){
 clearAuto()
 if(collaborationOpen.value)return
 if(aiRepairActive.value||!autoCompile.value||!autoDirty||!compileEnabled.value||recommendedUnavailable.value||hasActiveCompile.value||compiling.value||switchingFile.value||navigating.value||uploadBusy.value||saveError.value||disposed)return
 autoTimer=setTimeout(()=>{
  if(aiRepairActive.value||!autoCompile.value||!autoDirty||recommendedUnavailable.value||hasActiveCompile.value||compiling.value||switchingFile.value||navigating.value||uploadBusy.value||saveError.value||disposed||document.visibilityState==='hidden')return
  autoDirty=false;lastAutoCompile=Date.now();void compileNow()
 },Math.max(15000,60000-(Date.now()-lastAutoCompile)))
}
watch(autoCompile,enabled=>{if(enabled){autoDirty=previewStale.value||!previewJob.value;scheduleAuto()}else clearAuto()})
watch(compileJob,job=>{if(job?.status==='succeeded'&&job.pdf_available)previewJob.value=job})

const compileError = ref('')
const compiling = ref(false)
const canceling = ref(false)
const compileStateLabel = computed(() => {
  const labels: Record<string, string> = {
    queued: '排队中', running: '编译中', recovering: '恢复中',
    succeeded: '已完成', failed: '编译失败', canceled: '已取消', blocked: '已阻断',
  }
  return labels[compileJob.value?.status ?? ''] ?? '未知'
})
const hasActiveCompile = computed(() => !!compileJob.value &&
  ['queued', 'running', 'recovering'].includes(compileJob.value.status))
watch([hasActiveCompile,compiling,switchingFile,navigating,addingFile,saveError],()=>scheduleAuto())
const canCancelCompile = computed(() => hasActiveCompile.value && !compileJob.value?.cancel_requested)
let compilePollTimer: ReturnType<typeof setTimeout> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let saveRetryTimer: ReturnType<typeof setTimeout> | null = null
let saveRetryAttempt=0
let retryableSave=false
let savePromise: Promise<boolean> | null = null
let loadSerial = 0
let fileSerial = 0
let disposed = false
let pollSerial=0
let historySerial=0
let pendingSubmission:{projectId:string;revision:number;compiler:PaperCompiler;key:string}|null=null

async function loadProject() {
  const serial = ++loadSerial
  const requestedProjectId = projectId.value
  const ownerAtStart=accountId.value
  loading.value = true
  error.value = ''
  try {
    let [currentProject, currentFiles, capability] = await Promise.all([
      getPaperProject(requestedProjectId), listPaperFiles(requestedProjectId),
      Promise.resolve().then(() => getPaperCompileCapability(requestedProjectId)).catch(():PaperCompileCapability => ({ enabled: false, pdf_available: false })),
    ])
    if (disposed || serial !== loadSerial || requestedProjectId !== projectId.value || ownerAtStart!==accountId.value) return
    const manifestMatches=()=>currentProject.id===requestedProjectId&&!currentFiles.some(file=>file.project_head_revision!==undefined&&file.project_head_revision!==currentProject.head_revision)
    if(!manifestMatches()){
      // A concurrent save may occur between the project and file-list
      // requests. Retry once; never accept a mixed manifest.
      currentProject=await getPaperProject(requestedProjectId)
      currentFiles=await listPaperFiles(requestedProjectId)
      if(disposed||serial!==loadSerial||requestedProjectId!==projectId.value||ownerAtStart!==accountId.value)return
      if(!manifestMatches())throw Error('Project manifest changed during load')
    }
    project.value = currentProject
    files.value = currentFiles
    initializeLocalDrafts(ownerAtStart)
    compileEnabled.value = ownerAccess.value && capability?.enabled === true
    pdfEnabled.value = compileEnabled.value && capability?.pdf_available === true
    compilerOptions.value=['pdflatex']
    if(compileEnabled.value&&capability.compilers?.includes('xelatex'))compilerOptions.value.push('xelatex')
    if(compileEnabled.value&&capability.compilers?.includes('lualatex'))compilerOptions.value.push('lualatex')
    if(!compilerOptions.value.includes(selectedCompiler.value))selectedCompiler.value='pdflatex'

    const main = currentFiles.find((file) => file.id === currentProject.main_file_id) || currentFiles[0]
    if (main) await selectFile(main)
    if(disposed||serial!==loadSerial||requestedProjectId!==projectId.value)return
    if(main&&activeFile.value?.id===main.id&&activeFile.value.kind==='text'){
      recommendedCompiler.value=recommendedTexCompiler(activeFile.value.content)
      if(compileEnabled.value&&recommendedCompiler.value&&compilerOptions.value.includes(recommendedCompiler.value))selectedCompiler.value=recommendedCompiler.value
    }

    if(!ownerAccess.value&&!disposed&&serial===loadSerial&&ownerAtStart===accountId.value){
      resetSharedPreview()
      void loadSharedPreview()
    }
    if (compileEnabled.value && !disposed && serial === loadSerial) {
      // Do not hold the editor's loading state hostage to queue history.
      const historyRequest=++historySerial
      void listPaperCompileJobs(requestedProjectId).then((history) => {
        if (!disposed && serial === loadSerial && historyRequest===historySerial && requestedProjectId === projectId.value) {
          compileJob.value = history[0] ?? null
          const priorCompiler=compileJob.value?.compiler||recommendedCompiler.value||'pdflatex'
          if(!compilerChangedByUser&&compilerOptions.value.includes(priorCompiler))selectedCompiler.value=priorCompiler

          previewJob.value = history.find(job => job.status === 'succeeded' && job.pdf_available) ?? null
          scheduleCompilePoll()
        }
      }).catch(() => {})
    }
  } catch {
    if (!disposed && serial === loadSerial) {
      error.value = '无法打开论文。请确认项目存在且当前账号具有访问权限。'
    }
  } finally {
    if (!disposed && serial === loadSerial) loading.value = false
  }
}

function clearSaveRetry(){if(saveRetryTimer)clearTimeout(saveRetryTimer);saveRetryTimer=null}
function scheduleSaveRetry(){
 clearSaveRetry()
 if(!retryableSave||saveRetryAttempt>=3||navigator.onLine===false||disposed)return
 const delay=2000*2**saveRetryAttempt++
 saveRetryTimer=setTimeout(()=>{saveRetryTimer=null;if(retryableSave&&!disposed&&!navigating.value)void persist()},delay)
}
function reconnectSave(){if(!disposed&&activeFile.value?.kind==='text'&&draft.value!==activeFile.value.content&&retryableSave){saveRetryAttempt=0;clearSaveRetry();void persist()}}
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  clearSaveRetry();saveRetryAttempt=0
  saveStatus.value = navigator.onLine===false?'离线 · 尚未保存':'尚未保存'
  saveTimer = setTimeout(() => { void persist() }, 800)
}

watch(draft,()=>syncLocalDraft(),{flush:'sync'})
watch(draft, (content) => {
  if (!collaborationOpen.value && writeAccess.value && activeFile.value?.kind === 'text' && content !== activeFile.value.content) { scheduleSave();autoDirty=true;scheduleAuto() }
})

// All consumers share one drain promise. In particular a debounce callback
// and a file/route transition cannot issue concurrent optimistic-lock writes.
function persist(): Promise<boolean> {
  // The live Y.Doc owns text updates while this file is collaborative.
  if(collaborationOpen.value)return Promise.resolve(false)
  if(saveTimer){clearTimeout(saveTimer);saveTimer=null}
  clearSaveRetry()
  if(savePromise)return savePromise
  const pid=project.value?.id,owner=accountId.value,generation=loadSerial
  const initial=activeFile.value
  if(!pid||pid!==projectId.value||!initial||initial.kind!=='text')return Promise.resolve(true)
  if(!owner)return Promise.resolve(false)
  const currentScope=()=>!disposed&&owner===accountId.value&&generation===loadSerial&&project.value?.id===pid&&projectId.value===pid&&activeFile.value?.id===initial.id
  if(draft.value===initial.content){saveError.value='';retryableSave=false;saveRetryAttempt=0;saveStatus.value='已保存';return Promise.resolve(true)}
  if(!writeAccess.value){saveStatus.value='只读 · 尚未保存';saveError.value='当前账号已无编辑权限，请复制当前源码。';return Promise.resolve(false)}
  if(navigator.onLine===false){retryableSave=true;saveStatus.value='离线 · 尚未保存';saveError.value='当前网络已断开，恢复连接后将自动保存。';return Promise.resolve(false)}
  saving.value=true;saveStatus.value='保存中...'
  const work=(async()=>{
    while(currentScope()){
      const file=activeFile.value!,content=draft.value,priorHead=project.value!.head_revision
      if(content===file.content){saveStatus.value='已保存';saveError.value='';retryableSave=false;saveRetryAttempt=0;return true}
      try{
        const saved=await savePaperFile(pid,file.id,content,file.revision)
        if(!currentScope())return false
        if(saved.id!==file.id||saved.kind!=='text'||saved.path!==file.path||saved.content!==content||!Number.isSafeInteger(saved.revision)||saved.revision<file.revision||(saved.project_head_revision!==undefined&&(!Number.isSafeInteger(saved.project_head_revision)||saved.project_head_revision<priorHead)))throw new Error('Invalid saved file')
        activeFile.value=saved
        acknowledgeLocalDraft(saved)
        files.value=files.value.map(item=>item.id===saved.id?{...item,...saved,content:''}:item)
        const expectedHead=priorHead+(saved.revision>file.revision?1:0)
        const observedHead=saved.project_head_revision??expectedHead
        if(observedHead===expectedHead)project.value!.head_revision=observedHead
        else{
          // Do not advance the project CAS against a stale file manifest.
          // File-level saves remain safe; project-wide writes must refresh.
          refreshMessage.value='当前文件已保存，但其他窗口也更新了项目。请刷新项目后再执行全文检索、编译、文件管理或跨文件修改。'
        }
        saveError.value='';retryableSave=false;saveRetryAttempt=0
        if(saveTimer){clearTimeout(saveTimer);saveTimer=null}
      }catch(cause){
        if(currentScope()){
          saveStatus.value='保存失败'
          const code=cause instanceof ApiErrorResponseError?cause.code:''
          retryableSave=!(cause instanceof ApiErrorResponseError)||cause.status>=500||cause.status===429
          if(code==='papers.revision_conflict')retryableSave=false
          if(retryableSave)scheduleSaveRetry()

          if(code==='papers.read_only'||code==='papers.project_not_found'||code==='papers.invite_required'){if(project.value)project.value.access_role='viewer';compileEnabled.value=false;pdfEnabled.value=false;stopCompilePoll();clearAuto();closeTool();retryableSave=false}
          saveError.value=code==='papers.read_only'||code==='papers.project_not_found'||code==='papers.invite_required'?'项目编辑权限已变化，请复制当前源码。':code==='papers.revision_conflict'?'文件已被其他窗口或协作者修改。请复制当前源码，刷新后手动合并。':code==='papers.compile_source_limit'?'超过项目源码容量限制，请缩减内容后重试。':retryableSave?'网络或服务暂时不可用，恢复连接后将尝试保存。':'保存失败，请检查网络后重试。'
        }
        return false
      }
    }
    return false
  })()
  savePromise=work
  void work.finally(()=>{if(savePromise===work){savePromise=null;saving.value=false}})
  return work
}

async function copyDraft(){
  try{await navigator.clipboard.writeText(draft.value);saveStatus.value='当前源码已复制'}
  catch{saveStatus.value='请在编辑器中手动复制源码'}
}

async function selectFile(file:PaperFile){
  if(collaborationOpen.value)return
  if(navigating.value||preparingUpload.value||snapshotMutating.value)return
  const serial=++fileSerial
  const pid=projectId.value,owner=accountId.value
  if(activeFile.value?.id===file.id){switchingFile.value=false;if(compactLayout.value){showFiles.value=false;if(layoutMode.value==='pdf')layoutMode.value='editor'}return}
  switchingFile.value=true
  try{
    // Read-only is applied before saving or fetching another file. Keep
    // the active draft intact until the requested file actually arrives.
    await nextTick()
    if(activeFile.value&&!await persist())return
    if(disposed||serial!==fileSerial||pid!==projectId.value||navigating.value)return
    fileError.value=''
    const content=await getPaperFile(pid,file.id)
    if(content.id!==file.id||content.kind!==file.kind||!Number.isSafeInteger(content.revision)||content.revision<1)throw Error('Unexpected file response')
    if(disposed||serial!==fileSerial||pid!==projectId.value||navigating.value)return
    // A change emitted just before CodeMirror became read-only must also
    // be saved. Never overwrite a dirty draft with an incoming response.
    if(!await persist())return
    if(disposed||serial!==fileSerial||pid!==projectId.value||navigating.value)return
    if(content.revision!==file.revision||content.path!==file.path||(file.sha256&&content.sha256!==file.sha256)||(content.project_head_revision!==undefined&&content.project_head_revision!==project.value?.head_revision)){
      const [latest,manifest]=await Promise.all([getPaperProject(pid),listPaperFiles(pid)])
      if(disposed||serial!==fileSerial||pid!==projectId.value||owner!==accountId.value||navigating.value)return
      const row=manifest.find(item=>item.id===content.id)
      if(latest.id!==pid||!row||row.path!==content.path||row.kind!==content.kind||row.revision!==content.revision||(row.sha256&&row.sha256!==content.sha256)||(content.project_head_revision!==undefined&&latest.head_revision!==content.project_head_revision)||manifest.some(item=>item.project_head_revision!==undefined&&item.project_head_revision!==latest.head_revision)){
        fileError.value='项目在读取过程中发生变化，请刷新后重试。';return
      }
      project.value=latest;files.value=manifest
      refreshMessage.value=''
    }
    files.value=files.value.map(item=>item.id===content.id?{...item,...content,content:''}:item)
    activeFile.value=content;draft.value=content.kind==='text'?content.content:'';revealFile(content.path)
    saveStatus.value=content.kind==='binary'?'资源文件':'已保存'
    saveError.value=''
    if(compactLayout.value){showFiles.value=false;if(layoutMode.value==='pdf')layoutMode.value='editor'}
  }catch{if(!disposed&&serial===fileSerial&&pid===projectId.value)fileError.value='无法读取该文件，请重试。'}
  finally{if(serial===fileSerial)switchingFile.value=false}
}

async function selectTreeFile(file:PaperFile){
 if(!canChooseTreeFile.value)return
 await selectFile(file)
 if(activeFile.value?.id===file.id){aiExpanded.value=false;if(compactLayout.value||layoutMode.value==='pdf')setWorkspaceLayout('editor')}
}
async function addFile(){
  if(!ownerAccess.value||!newFilePath.value||uploadBusy.value||switchingFile.value||navigating.value)return
  const pid=projectId.value
  addingFile.value=true;fileError.value=''
  try{
    await nextTick()
    if(!await persist()||disposed||pid!==projectId.value||navigating.value)return
    const created=await createPaperFile(pid,newFilePath.value)
    if(disposed||pid!==projectId.value||navigating.value)return
    files.value=[...files.value,created].sort((a,b)=>a.path.localeCompare(b.path))
    if(project.value){
      const expected=project.value.head_revision+1
      if(created.project_head_revision===undefined||created.project_head_revision===expected)project.value.head_revision=expected
      else refreshMessage.value='文件已创建，但其他窗口也更新了项目。正在核对项目文件清单。'
    }
    newFilePath.value=''
    autoDirty=true
    await selectFile(created)
  }catch(cause){
    if(!disposed&&pid===projectId.value)fileError.value=cause instanceof ApiErrorResponseError&&cause.code==='papers.file_exists'?'文件名与现有文件或文件夹冲突。':'无法创建文件，请检查路径、格式或项目容量。'
  }finally{if(pid===projectId.value){addingFile.value=false;scheduleAuto()}}
}

function stopCompilePoll() {
  if (compilePollTimer) clearTimeout(compilePollTimer)
  compilePollTimer = null
}

function scheduleCompilePoll() {
  stopCompilePoll()
  if (disposed || !compileEnabled.value || !compileJob.value ||
      !['queued', 'running', 'recovering'].includes(compileJob.value.status)) return
  compilePollTimer = setTimeout(() => { void refreshCompileStatus() }, 2500)
}

async function refreshCompileStatus() {
  const current = compileJob.value
  const requestedProjectId = projectId.value
  if (!current || disposed || !compileEnabled.value || canceling.value) return
  const serial=++pollSerial
  if (document.visibilityState === 'hidden') { scheduleCompilePoll(); return }
  try {
    const latest = await getPaperCompileJob(requestedProjectId, current.id)
    if (disposed || serial!==pollSerial || requestedProjectId !== projectId.value || compileJob.value?.id !== current.id) return
    compileJob.value = latest
    compileError.value = ''
  } catch {
    if (!disposed && serial===pollSerial && requestedProjectId === projectId.value) compileError.value = '暂时无法更新编译状态，请检查网络。'
  } finally {
    if (!disposed && serial===pollSerial && requestedProjectId === projectId.value) scheduleCompilePoll()
  }
}

async function compileNow(){if(aiRepairActive.value||aiApplying.value)return;return submitCompile()}
async function compileForAI(revision:number,compiler:PaperCompiler):Promise<PaperCompileJob|null>{
 if(!aiRepairActive.value||toolMode.value!=='ai'||collaborationOpen.value||project.value?.head_revision!==revision||selectedCompiler.value!==compiler||draft.value!==activeFile.value?.content||saving.value||savePromise||saveError.value||!activeFile.value)return null
 return await submitCompile({revision,compiler})??null
}
async function submitCompile(expected?:{revision:number;compiler:PaperCompiler}):Promise<PaperCompileJob|undefined> {
  if (!compileEnabled.value || !ownerAccess.value || compiling.value || snapshotMutating.value || hasActiveCompile.value || !project.value || switchingFile.value || navigating.value || uploadBusy.value || disposed) return
  const collaborating=collaborationOpen.value
  if(collaborating&&currentCollaborationRevision()===null)return
  const requestedProjectId = projectId.value,owner=accountId.value
  compileError.value = ''
  clearAuto();autoDirty=false;lastAutoCompile=Date.now()
  compiling.value = true
  historySerial++
  try {
    // Do not compile an unsaved draft, even if a debounce timer is pending.
    if (!collaborating&&!await persist()) {
      compileError.value = '请先解决源码保存失败或版本冲突。'
      return
    }
    const revision=collaborating?currentCollaborationRevision():project.value?.head_revision
    if(disposed||requestedProjectId!==projectId.value||owner!==accountId.value||collaborating!==collaborationOpen.value||!revision)return
    if(expected&&(!aiRepairActive.value||toolMode.value!=='ai'||revision!==expected.revision||selectedCompiler.value!==expected.compiler||draft.value!==activeFile.value?.content||collaborationOpen.value))return
    if(!pendingSubmission||pendingSubmission.projectId!==requestedProjectId||pendingSubmission.revision!==revision||pendingSubmission.compiler!==selectedCompiler.value){
      pendingSubmission={projectId:requestedProjectId,revision,compiler:selectedCompiler.value,key:globalThis.crypto?.randomUUID?.()??('compile-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2))}
    }
    const job=await (pendingSubmission.compiler==='pdflatex'?submitPaperCompile(requestedProjectId,revision,pendingSubmission.key):submitPaperCompile(requestedProjectId,revision,pendingSubmission.key,pendingSubmission.compiler))
    if(disposed||requestedProjectId!==projectId.value||owner!==accountId.value)return
    pendingSubmission=null
    compileJob.value = job
    scheduleCompilePoll()
    return job
  } catch(cause) {
    if (!disposed && requestedProjectId === projectId.value&&owner===accountId.value){
      const code=cause instanceof ApiErrorResponseError?cause.code:''

      compileError.value=code==='papers.compile_revision_conflict'||code==='papers.revision_conflict'?(collaborating?'项目版本已变化，请等待协作同步完成后重新编译。':'项目版本已在其他窗口发生变化，请复制未保存内容后刷新。'):code==='papers.compile_quota_exceeded'?'已达到编译频率或存储限制，请稍后重试。':code==='papers.compiler_unavailable'?'当前编译环境尚未开放此编译器，请刷新项目或切换编译器。':'无法提交编译任务，请检查网络或编译环境后重试。'
    }
  } finally {
    if(requestedProjectId===projectId.value&&owner===accountId.value)compiling.value = false
  }
}

async function cancelCompile() {
  if (!canCancelCompile.value || canceling.value || !compileJob.value) return
  const requestedProjectId = projectId.value
  const jobId = compileJob.value.id
  canceling.value = true
  pollSerial++;stopCompilePoll()
  try {
    const updated = await cancelPaperCompile(requestedProjectId, jobId)
    if (disposed || requestedProjectId !== projectId.value || compileJob.value?.id !== jobId) return
    compileJob.value = updated
    scheduleCompilePoll()
  } catch {
    if (!disposed && requestedProjectId === projectId.value)
      compileError.value = '取消请求失败，请重新检查任务状态。'
  } finally {
    if(requestedProjectId===projectId.value){canceling.value=false;scheduleCompilePoll()}
  }
}

function onCompileVisibilityChange() {
  if (document.visibilityState === 'visible') { void refreshCompileStatus();scheduleAuto() }
}

async function exportProject() {
  if (collaborationOpen.value || !ownerAccess.value || exporting.value || !project.value) return
  exporting.value = true
  exportError.value = ''
  const id = projectId.value
  const name = project.value.name
  try {
    if (!await persist()) { exportError.value = '请先解决保存失败或版本冲突再导出。'; return }
    if (disposed || id !== projectId.value) return
    const blob = await getPaperProjectZIP(id)
    if (!disposed && id === projectId.value) downloadPaperZIP(blob, name)
  } catch {
    if (!disposed && id === projectId.value) exportError.value = '导出失败，请稍后重试。'
  } finally { if(id===projectId.value)exporting.value = false }
}

function saveNow() { if(!collaborationOpen.value&&writeAccess.value){saveRetryAttempt=0;void persist()} }

// A separate editor session owns the collaborative document. Never promote
// its local text into the ordinary full-text PUT/autosave path. On exit,
 // reload the accepted canonical source and revision from the server.
const collaborationRole=computed<PaperProjectRole>(()=>ownerAccess.value?'owner':writeAccess.value?'editor':'viewer')
const collaborationScope=computed(()=>{
 const file=activeFile.value
 if(!accountId.value||project.value?.id!==projectId.value||file?.kind!=='text')return ''
 return JSON.stringify([accountId.value,projectId.value,file.id,collaborationRole.value])
})
type CollaborationGate={scope:string;state:'idle'|'checking'|'available'|'unavailable';message:string}
const collaborationGate=ref<CollaborationGate>({scope:'',state:'idle',message:''})
let collaborationGateSerial=0
const collaborationGateMessage=computed(()=>{
 if(!collaborationScope.value)return ''
 if(collaborationGate.value.scope!==collaborationScope.value)return '正在检查实时协作能力…'
 return collaborationGate.value.message
})
async function checkCollaborationCapability(){
 const scope=collaborationScope.value,serial=++collaborationGateSerial
 const file=activeFile.value,pid=projectId.value,role=collaborationRole.value
 if(!scope||!file||disposed||collaborationOpen.value){
  collaborationGate.value={scope:'',state:'idle',message:''}
  return
 }
 collaborationGate.value={scope,state:'checking',message:'正在检查实时协作能力…'}
 let reason:string
 try{reason=collaborationUnavailableReason(await getPaperCollaborationCapability(pid,file.id),role)}
 catch(error){reason=collaborationCapabilityError(error)}
 if(disposed||serial!==collaborationGateSerial||scope!==collaborationScope.value||collaborationOpen.value)return
 collaborationGate.value={scope,state:reason?'unavailable':'available',message:reason}
}
watch(collaborationScope,()=>{if(!collaborationOpen.value)void checkCollaborationCapability()},{immediate:true})
function onCollaborationUnavailable(reason:string){
 // The panel only emits this before creating a collaborative session.
 // Preserve the clean ordinary buffer; do not reload, clear or write it.
 if(!collaborationOpen.value||collaborationAccount.value!==accountId.value||collaborationRef.value?.hasUnconfirmed())return
 ++collaborationGateSerial
 collaborationGate.value={scope:collaborationScope.value,state:'unavailable',message:reason}
 collaborationOpen.value=false;collaborationAccount.value='';collaborationRevision.value=null;aiSharedState.value=null
 saveStatus.value='普通编辑 · 未进入协作'
}
const canStartCollaboration=computed(()=>!collaborationOpen.value&&!disposed&&!!accountId.value&&
 collaborationGate.value.scope===collaborationScope.value&&collaborationGate.value.state==='available'&&
 activeFile.value?.kind==='text'&&draft.value===activeFile.value.content&&
 !loading.value&&!saving.value&&!switchingFile.value&&!navigating.value&&!uploadBusy.value&&
 !snapshotMutating.value&&!memberMutating.value&&!toolBusy.value&&!compiling.value&&!hasActiveCompile.value&&!exporting.value&&!saveError.value)
function startCollaboration(){
 if(!canStartCollaboration.value||savePromise||!activeFile.value)return
 if(saveTimer){clearTimeout(saveTimer);saveTimer=null}
 clearSaveRetry();retryableSave=false
 leaveFocus();closeTool();outlineOpen.value=false;managedFile.value=null;clearAuto();autoCompile.value=false;historySerial++
 collaborationAccount.value=accountId.value;collaborationRevision.value=null;aiSharedState.value=null
 collaborationOpen.value=true;saveStatus.value='实时协作模式'
 if(layoutMode.value==='pdf')layoutMode.value='editor'
}
async function exitCollaboration(){
 if(!collaborationOpen.value||snapshotMutating.value||compiling.value)return
 const pid=projectId.value,owner=accountId.value,fid=activeFile.value?.id
 // Do not reveal the pre-collaboration source even if a compile-history
 // response raced the exit or the canonical reload fails.
 loading.value=true
 activeFile.value=null;draft.value=''
 collaborationOpen.value=false;collaborationAccount.value='';collaborationRevision.value=null;aiSharedState.value=null
 closeTool();clearAuto();stopCompilePoll();pollSerial++;historySerial++;fileSerial++
 compileJob.value=null;previewJob.value=null;compileEnabled.value=false;pdfEnabled.value=false
 searchSources.value=[];searchBase.value=0;bibSources.value=[];outlineCache.value=[];members.value=[];managedFile.value=null
 saveStatus.value='正在重新读取服务器版本'
 await loadProject()
 if(disposed||pid!==projectId.value||owner!==accountId.value||error.value)return
 const previous=files.value.find(file=>file.id===fid)
 if(previous)await selectFile(previous)
}
watch(accountId,(next,previous)=>{
 if(next!==previous)resolveConfirmation(false)
 if(next===previous)return
 resetSharedPreview()
 // A different account must never inherit another account's live Y.Doc,
 // canonical source or previously authorized PDF.
 collaborationOpen.value=false;collaborationAccount.value='';collaborationRevision.value=null;aiSharedState.value=null
 loadSerial++;fileSerial++;pollSerial++;historySerial++;mapSerial++
 pendingSubmission=null;compiling.value=false;canceling.value=false;snapshotMutating.value=false;addingFile.value=false;aiApplying.value=false;aiRepairActive.value=false;savePromise=null;saving.value=false;clearSaveRetry();retryableSave=false;if(saveTimer){clearTimeout(saveTimer);saveTimer=null}
 clearAuto();stopCompilePoll();mapAbort?.abort()
 activeFile.value=null;draft.value='';files.value=[];project.value=null
 previewJob.value=null;compileJob.value=null;sourceMap.value=null
 compileEnabled.value=false;pdfEnabled.value=false
 closeTool();resetLocalDraftScope()
 error.value='登录账号已变化，请重新打开论文项目。';loading.value=false
},{flush:'sync'})

// A manual refresh is deliberately clean-only. Never silently discard a
// conflicting local draft or change its base revision to force a save.
async function refreshServerProject(){
 if(collaborationOpen.value)return
 if(disposed||loading.value||switchingFile.value||navigating.value||saving.value||uploadBusy.value||snapshotMutating.value||memberMutating.value||compiling.value||hasActiveCompile.value)return
 if(activeFile.value?.kind==='text'&&draft.value!==activeFile.value.content){refreshMessage.value='当前源码尚未保存，请先复制并处理冲突；未刷新项目。';return}
 switchingFile.value=true
 const pid=projectId.value,serial=++fileSerial
 try{
  await nextTick()
  if(activeFile.value?.kind==='text'&&draft.value!==activeFile.value.content){refreshMessage.value='存在未保存源码，未刷新项目。';return}
  if(disposed||pid!==projectId.value||serial!==fileSerial)return
  closeTool();clearAuto();stopCompilePoll();pollSerial++;historySerial++
  compileJob.value=null;previewJob.value=null;compileEnabled.value=false;pdfEnabled.value=false
  activeFile.value=null;draft.value='';searchSources.value=[];searchBase.value=0;bibSources.value=[];outlineCache.value=[];members.value=[];managedFile.value=null
  switchingFile.value=false
  await loadProject()
  if(!disposed&&pid===projectId.value&&!error.value)refreshMessage.value='已刷新服务器版本。'
 }finally{if(pid===projectId.value)switchingFile.value=false}
}


function beforeUnload(event: BeforeUnloadEvent) {
  if(collaborationOpen.value){if(collaborationRef.value?.hasUnconfirmed()){event.preventDefault();event.returnValue=''};return}
  syncLocalDraft()
  if (savePromise || (activeFile.value?.kind === 'text' && draft.value !== activeFile.value.content)) {
    event.preventDefault();event.returnValue=''
  }
}

async function beforeNavigate(){
 resolveConfirmation(false)
 if(collaborationOpen.value){refreshMessage.value='请先退出实时协作，再离开项目。';return false}
 if(snapshotMutating.value||memberMutating.value||aiApplying.value)return false
 navigating.value=true
 fileSerial++;switchingFile.value=false
 clearAuto()
 await nextTick()
 const saved=await persist()
 if(!saved)navigating.value=false
 return saved
}
onBeforeRouteLeave(beforeNavigate)
onBeforeRouteUpdate(beforeNavigate)
const removeNavigationHook=router.afterEach(()=>{navigating.value=false})

watch(projectId, () => {
  resetSharedPreview()
  collaborationOpen.value=false;collaborationAccount.value='';collaborationRevision.value=null;aiSharedState.value=null
  loadSerial++
  uploadSerial++;preparingUpload.value=false;draggingFiles.value=false
  memberSerial++;members.value=[];memberMessage.value='';memberMutating.value=false;refreshMessage.value=''
  resetLocalDraftScope();snapshots.value=[];snapshotDetail.value=null;snapshotMessage.value='';snapshotMutating.value=false
  closeTool();bibSerial++;bibSources.value=[];bibError.value='';searchBase.value=0;searchSources.value=[];fileVersions.value=[];clearSaveRetry();retryableSave=false;saveRetryAttempt=0
  fileSerial++;pollSerial++;historySerial++;pendingSubmission=null
  switchingFile.value=false;addingFile.value=false;compiling.value=false;canceling.value=false;exporting.value=false;saveError.value='';fileError.value=''
  stopCompilePoll()
  compileJob.value = null
  previewJob.value = null
  displayedPDFJob.value='';sourceMap.value=null;mapJob.value='';mapAbort?.abort();mapSerial++;syncMessage.value=''
  clearAuto();autoDirty=false
  compileEnabled.value = false
  selectedCompiler.value='pdflatex';compilerOptions.value=['pdflatex'];compilerChangedByUser=false;recommendedCompiler.value=undefined
  pdfEnabled.value = false
  compileError.value = ''
  exportError.value = ''
  activeFile.value = null
  draft.value = ''
  files.value = []
  closedFolders.value=new Set();managedFile.value=null;uploadDir.value='';outlineSerial++;outlineCache.value=[];outlineOpen.value=false;outlineLoading.value=false
  project.value = null
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  void loadProject()
})

function onShortcut(e:KeyboardEvent){
 if(e.defaultPrevented||e.isComposing||e.repeat)return
 if(quickOpen.value||confirmationMessage.value)return
 if((e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='p'&&canSwitchWorkspaceFile.value){e.preventDefault();openQuick();return}
 if(e.key==='Escape'&&focusMode.value){e.preventDefault();leaveFocus();return}
 if(e.key==='Escape'&&compactLayout.value&&showFiles.value){e.preventDefault();showFiles.value=false;return}
 if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();void compileNow()}
}
onMounted(() => {
  window.addEventListener('keydown',onShortcut)
  window.addEventListener('resize',onViewportChange)
  void loadProject()
  window.addEventListener('beforeunload', beforeUnload)
  window.addEventListener('online', reconnectSave)
  window.addEventListener('storage',onDraftStorage)
  document.addEventListener('visibilitychange', onCompileVisibilityChange)
})

onBeforeUnmount(() => {
  disposed = true
  resetSharedPreview()
  memberSerial++;uploadSerial++;draggingFiles.value=false
  closeTool();bibSerial++;clearSaveRetry()
  loadSerial++
  fileSerial++
  if (saveTimer) clearTimeout(saveTimer)
  clearAuto()
  mapAbort?.abort();mapSerial++
  window.removeEventListener('beforeunload', beforeUnload)
  window.removeEventListener('online', reconnectSave)
  window.removeEventListener('storage',onDraftStorage)
  window.removeEventListener('keydown',onShortcut)
  window.removeEventListener('resize',onViewportChange)
  document.removeEventListener('visibilitychange', onCompileVisibilityChange)
  stopCompilePoll()
  removeNavigationHook()
  // Router guards drain before leaving; never start a save after disposal.
})
</script>


<style scoped src="./PaperWorkspaceLayout.css"></style>

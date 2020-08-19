<template>
  <div>
    <h3>文件上传</h3>
    <div 
      ref="drag"
      @drop="onDrop"
      @dragover="onDragover"
      @dragleave="onDragleave"
      class="drag"
    >
      <input type="file" name="file" @change="handleFileChange">
    </div>
    <p>计算文件hash进度</p>
    <div>
      <el-progress :stroke-width='20' :text-inside="true" :percentage="hashProgress" ></el-progress>
    </div>
    <p>文件上传进度</p>
    <div>
      <el-progress :stroke-width='20' :text-inside="true" :percentage="uploadProgress" ></el-progress>
    </div>
    <el-button class="btn" type="primary" @click="uploadFile">Upload</el-button>
    <div class="cube-container" :style="{width:cubeWidth+'px'}">
      <div class="cube" v-for="chunk in chunks" :key="chunk.name">
        <div
          :class="{
            'uploading': chunk.progress > 0 && chunk.progress < 100,
            'success': chunk.progress === 100,
            'error': chunk.progress < 0
          }"
          :style="{ height: chunk.progress + '%' }"
        >
          <i class="el-icon-loading" style="color:#f56c6c" v-if="chunk.progress<100 && chunk.progress>0"></i>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
  import sparkMD5 from 'spark-md5'
  const CHUNK_SIZE = 0.5 * 1024 * 1024
  export default {
    data() {
      return {
        file: null,
        chunks: [],
        hashProgress: 0,
        uploadedsucceed: false
      }
    },
    computed: {
      cubeWidth() {
        return Math.ceil(Math.sqrt(this.chunks.length)) * 16
      },
      uploadProgress() {
        if(this.uploadedsucceed) {
          return 100
        }
        if(!this.file || !this.chunks.length) {
          return 0
        }
        const loaded = this.chunks.map(item=>item.chunk.size*item.progress)
                        .reduce((acc,cur)=>acc+cur,0)
        const progress = parseInt(((loaded)/this.file.size).toFixed(2))
        console.log(progress)
        return progress
      }
    },
    methods: {
      onDrop(e) {
        e.preventDefault()
        this.$refs.drag.style.borderColor = '#eee'
        this.file = e.dataTransfer.files[0]
      },
      onDragover(e) {
        e.preventDefault()
        this.$refs.drag.style.borderColor = 'red'
      },
      onDragleave(e) {
        e.preventDefault()
        this.$refs.drag.style.borderColor = '#eee'
      },
      async blobToString(blob) {
        return new Promise(resolve=>{
          const reader = new FileReader()
          reader.onload = function(){
            console.log(reader.result)
            const ret = reader.result.split('')
                          .map(v=>v.charCodeAt())
                          .map(v=>v.toString(16).toUpperCase())
                          .join('')
            resolve(ret)
          }
          reader.readAsBinaryString(blob)
        })
      },
      async isGif(file) {
        // GIF89a 和GIF87a
        // 前面6个16进制，'47 49 46 38 39 61' '47 49 46 38 37 61'
        // 16进制的抓安环
        const ret = await this.blobToString(file.slice(0,6))
        const isGif = (ret=='47 49 46 38 39 61') || (ret=='47 49 46 38 37 61')
        return isGif
      },
      async isPng(file){
        const ret = await this.blobToString(file.slice(0,8))
        const ispng = (ret == "89 50 4E 47 0D 0A 1A 0A")
        return ispng
      },
      async isJpg(file){
        const len = file.size
        const start = await this.blobToString(file.slice(0,2))
        const tail = await this.blobToString(file.slice(-2,len))
        const isjpg = (start=='FF D8') && (tail=='FF D9')
        return isjpg
      },
      async isImage(file){
        // 通过文件流来判定
        // 先判定是不是图片
        return await this.isGif(file) || await this.isPng(file) || await this.isJpg(file)
      },
      createFileChunk(file, size = CHUNK_SIZE) {
        const chunks = []
        let curSize = 0
        while(curSize < this.file.size) {
          chunks.push({
            index: curSize,
            file: this.file.slice(curSize, curSize + size)
          })
          curSize += size
        }
        return chunks
      },
      async calculateHashWorker(chunks) {
        return new Promise(resolve => {
          this.worker = new Worker('./hash.js')
          this.worker.postMessage({ chunks })
          this.worker.onmessage = e => {
            const { progress, hash } = e.data
            this.hashProgress = Number(progress.toFixed(2))
            if(hash) {
              resolve(hash)
            }
          }
        })
      },
      async calculateHashIdle() {
        const chunks = this.chunks
        return new Promise(resolve => {
          const spark = new sparkMD5.ArrayBuffer()
          let count = 0

          const appendToSpark = async file => {
            return new Promise(resolve => {
              const reader = new FileReader()
              reader.readAsArrayBuffer(file)
              reader.onload = e => {
                spark.append(e.target.result)
                resolve()
              }
            })
          }

          const workLoop = async deadline => {
            // timeRemaining获取当前帧的剩余时间
            while(count < chunks.length && deadline.timeRemaining() > 1) {
              // 空闲时间，且有任务
              await appendToSpark(chunks[count].file)
              count++
              if(count < chunks.length) {
                this.hashProgress = Number(
                  ((100 * count) / chunks.length).toFixed(2)
                )
              } else {
                this.hashProgress = 100
                resolve(spark.end())
              }
            }
            window.requestIdleCallback(workLoop)
          }
          window.requestIdleCallback(workLoop)
        })
      },
      async calculateHashSample() {
        // 布隆过滤器 判断一个数据存在与否
        // 一个G的文件，抽样后5M以内
        // hash一样，文件不一定一样
        // hash不一样，文件一定不一样
        return new Promise(resolve => {
          const spark = new sparkMD5.ArrayBuffer()
          const reader = new FileReader()
          const file = this.file
          const size = file.size
          const offset = 2 * 1024 * 1024
          // 第一个2M，最后一个区块数据全要
          let chunks = [file.slice(0, offset)]
          let cur = offset
          while(cur < size) {
            if(cur + offset >= size) {
              // 最后一个区块
              chunks.push(file.slice(cur, cur + offset))
            } else {
              // 中间区块
              const mid = cur + offset / 2
              const end = cur + offset
              chunks.push(file.slice(cur, cur + 2))
              chunks.push(file.slice(mid, mid + 2))
              chunks.push(file.slice(end - 2, end))
            }
          }
          // 中间的，去前中后各两个字节
          reader.readAsArrayBuffer(new Blob(chunks))
          reader.onload = e => {
            spark.append(e.target.result)
            this.hashProgress = 100
            resolve(spark.end())
          }
        })
      },
      async uploadFile() {
        // if(!await this.isImage(this.file)) {
        //   alert('文件格式不对')
        //   return
        // }
        const chunks = this.createFileChunk(this.file)
        const hash = await this.calculateHashWorker(chunks)
        this.hash = hash
        // const hash1 = await this.calculateHashIdle()
        // const hash12 = await this.calculateHashSample()


        // 问一下后端，文件是否上传过，如果没有，是否有存在的切片
        const { data: { data: { uploaded, uploadedList } } } = await this.$http.post('checkfile',{
          hash: this.hash,
          ext: this.file.name.split('.').pop()
        })
        if(uploaded) {
          this.uploadedsucceed = true
          return this.$message.success('秒传成功！')
        }
        this.uploadedsucceed = false
        this.chunks = chunks.map((chunk, index) => {
          // 切片的名字，hash + index
          const name = `${hash}-${index}`
          return {
            hash,
            name,
            index,
            chunk: chunk.file,
            progress: uploadedList.indexOf(name) > -1 ? 100 : 0
          }
        })
        await this.uploadChunks(uploadedList)
      },
      async uploadChunks(uploadedList=[]) {
        const requests = this.chunks
          // 将已上传的切片过滤掉
          .filter(chunk => uploadedList.indexOf(chunk.name) === -1)
          .map((chunk, index) => {
          // 转成Promise
          const form = new FormData()
          form.append('chunk', chunk.chunk)
          form.append('hash', chunk.hash)
          form.append('name', chunk.name)
          return {
            form,
            index: chunk.index,
            error: 0
          }
        })
        await this.sendRequest(requests)
        await this.mergeRequest()
      },
      async sendRequest(chunks, limit = 4) {
        // limit: 并发数
        return new Promise((resolve, reject) => {
          const len = chunks.length
          let counter = 0
          let isStop = false
          const start = async () => {
            if(isStop) {
              return
            }
            const task = chunks.shift()
            if(task) {
              const { form, index } = task
              try {
                await this.$http.post('/uploadfile', form, {
                  onUploadProgress: progress=>{
                    // 不是整体的进度条了，而是每个区块有自己的进度条，整体的进度条需要计算
                    this.chunks[index].progress = Number(((progress.loaded / progress.total) * 100).toFixed(2))
                  }
                })
                if(counter === (len - 1)) {
                  // 最后一个任务
                  resolve()
                } else {
                  counter++
                  // 启动下一个任务
                  start()
                }
              } catch (error) {
                this.chunks[index].progress = -1
                if(task.error < 3) {
                  task.error++
                  chunks.unshift(task)
                  start()
                } else {
                  // 错误三次
                  isStop = true
                  reject()
                }
              }
            }
          }

          while(limit > 0) {
            // 启动limit个任务，模拟一下延迟
            setTimeout(() => {
              start()
            }, Math.random() * 2000)
            limit -= 1
          }
        })
      },
      async mergeRequest() {
        const ret = await this.$http.post('/mergefile', {
          ext: this.file.name.split('.').pop(),
          size: CHUNK_SIZE,
          hash: this.hash
        })
        console.log(ret)
      },
      handleFileChange(e) {
        const [file] = e.target.files
        if(!file) return
        this.file = file
      }
    }
  }
</script>

<style scoped>
.drag {
  width: 100%;
  height: 100px;
  line-height: 100px;
  border: 2px dashed #eee;
  text-align: center;
  vertical-align: middle;
  margin: 20px 0;
}
.btn {
  margin-top: 20px;
}
.cube {
  width: 14px;
  height: 14px;
  line-height: 12px;
  border: 1px solid black;
  background: #eee;
  float: left;
}
.success {
  background: green;
}
.uploading {
  background: blue;
}
.error {
  background: red;
}
</style>
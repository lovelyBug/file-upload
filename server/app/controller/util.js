const BaseController = require('./base')
const fse = require('fs-extra')
const path = require('path')

class UtilController extends BaseController {
  async checkFile() {
    const { ctx } = this
    const { ext, hash } = ctx.request.body
    const filePath = path.resolve(this.config.UPLOAD_DIR, `${hash}.${ext}`)

    let uploaded = false
    let uploadedList = []
    if(fse.existsSync(filePath)) {
      uploaded = true
    } else {
      uploadedList = await this.getUploadedList(path.resolve(this.config.UPLOAD_DIR, hash))
    }
    this.success({
      uploaded,
      uploadedList
    })
  }
  async getUploadedList(dirPath) {
    return fse.existsSync(dirPath)
           ? (await fse.readdir(dirPath)).filter(name => name[0] !== '.')
           : []
  }
  async uploadfile() {
    // 报错
    if(Math.random() > 0.7){
      return this.ctx.status = 500
    }
    const { ctx } = this
    const file = ctx.request.files[0]
    const { name, hash } = ctx.request.body
    const chunkPath = path.resolve(this.config.UPLOAD_DIR, hash)
    if(!fse.existsSync(chunkPath)) {
      await fse.mkdir(chunkPath)
    }
    await fse.move(file.filepath, `${chunkPath}/${name}`)
    this.message('切片上传成功')
  }
  async mergeFile() {
    const { ext, size, hash } = this.ctx.request.body
    const filepath = path.resolve(this.config.UPLOAD_DIR, `${hash}.${ext}`)
    await this.ctx.service.tools.mergeFile(filepath, hash, size)
    this.success({
      url: `/public/${hash}.${ext}`,
    })
  }
}
module.exports = UtilController
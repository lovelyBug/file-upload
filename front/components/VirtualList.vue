<template>
  <div
    ref="list"
    class="infinite-list-container"
    @scroll="scrollEvent($event)"
  >
    <div class="infinite-list-phantom" :style="{ height: `${listHeight}px` }"></div>
    <div class="infinite-list" :style="{ transform: getTransform }">
      <div
        ref="items"
        class="infinite-list-item"
        v-for="(item, index) in visiableData"
        :key="index"
        :style="{ height: `${itemSize}px` }"
      >
        <h3>{{ item.title }}</h3>
        <p>{{ item.content }}</p>
      </div>
    </div>
  </div>
</template>

<script>
  export default {
    props: {
      listData: {
        type: Array,
        default: () => []
      },
      // 每项高度
      itemSize: {
        type: Number,
        default: 200
      }
    },
    data() {
      return {
        screenHeight: 800,
        //偏移量
        startOffset: 0,
        //起始索引
        start: 0,
        //结束索引
        end: 4
      }
    },
    computed: {
      // 列表总高度
      listHeight() {
        return this.listData.length * this.itemSize
      },
      // 可显示的列表项数
      visiableCount() {
        return Math.ceil(this.screenHeight / this.itemSize)
      },
      // 偏移量对应的style
      getTransform() {
        return `translate3d(0,${this.startOffset}px,0)`
      },
      // 获取真实列表数据
      visiableData() {
        const data = this.listData.slice(this.start, Math.min(this.end, this.listData.length))
        return data
      }
    },
    methods: {
      scrollEvent() {
        // 当前滚动位置
        let scrollTop = this.$refs.list.scrollTop
        // 此时的开始索引
        this.start = Math.floor(scrollTop / this.itemSize)
        // 此时的结束索引
        this.end = this.start + this.visiableCount
        // 此时的偏移量
        this.startOffset = scrollTop - (scrollTop % this.itemSize)
      }
    },
  }
</script>

<style scoped>
.infinite-list-container {
  height: 100vh;
  overflow: auto;
  position: relative;
  -webkit-overflow-scrolling: touch;
}

.infinite-list-phantom {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  z-index: -1;
}

.infinite-list {
  left: 0;
  right: 0;
  top: 0;
  position: absolute;
}

.infinite-list-item {
  padding: 10px;
  color: #555;
  border-bottom: 1px solid #999;
}
</style>
<template>
  <div>
    <VirtualList
      :listData="listData"
      :itemSize="200"
    />
  </div>
</template>

<script>
  import VirtualList from '../components/VirtualList.vue'
  export default {
    components: {
      VirtualList
    },
    data() {
      return {
        listData: new Array(50).fill({
          title: '文章标题',
          content: '欲穷千里目，更上一层楼；君不见黄河之水天上来，奔流到海不复回。'
        })
      }
    }
  }
</script>

<style scoped>

</style>
module.exports = function (source) {
  // 将import语句转换为HOC组件导入语句
  const transformedSource = source.replace(
    /import\s+\{\s+([a-zA-Z, ]*)\s+\}\s+from\s+['"]@icon-park\/react['"](;?)/g,
    function (str, match) {
      if (!match) return str;
      const components = match.split(",");
      const importComponent = str.replace(
        match,
        components.map((key) => {
          return `${key} as _${key.trim()}`;
        })
      );

      const hoc = `import IconParkHOC from '@renderer/components/IconParkHOC';
          ${components
            .map((key) => {
              return `const ${key} = IconParkHOC(_${key.trim()})`;
            })
            .join(";\n")}
        `;

      return (
        importComponent + ";" + hoc
        // `; console.log(${components
        //   .map((k) => '_' + k)
        //   .join(',')}); console.log(${components.join()});`
      );
    }
  );
  return transformedSource;
};
